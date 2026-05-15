package com.dobakggun.service.yacht.bot;

import lombok.extern.slf4j.Slf4j;
import java.io.*;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.file.*;
import java.util.zip.CRC32;

/** W 테이블 바이너리 직렬화/역직렬화. */
@Slf4j
public final class YachtDpTable {

    private static final int VERSION = 1;

    /**
     * classpath에서 테이블 로드 시도.
     * 파일 없거나 손상된 경우 null 반환.
     */
    public static double[] load(YachtDpContext ctx) {
        var url = YachtDpTable.class.getClassLoader().getResource(ctx.binFileName);
        if (url == null) {
            log.info("YachtDpTable: {} 없음 — 사전 계산 필요", ctx.binFileName);
            return null;
        }
        try (InputStream is = url.openStream()) {
            double[] table = read(is, ctx);
            log.info("YachtDpTable: {} 로드 완료 ({} entries)", ctx.binFileName, ctx.tableSize);
            return table;
        } catch (Exception e) {
            log.warn("YachtDpTable: {} 로드 실패 ({}) — 재계산 필요", ctx.binFileName, e.getMessage());
            return null;
        }
    }

    /**
     * 테이블을 resourcesDir/{ctx.binFileName} 에 저장.
     */
    public static void save(double[] table, Path resourcesDir, YachtDpContext ctx) throws IOException {
        Path out = resourcesDir.resolve(ctx.binFileName);
        try (DataOutputStream dos = new DataOutputStream(
                new BufferedOutputStream(Files.newOutputStream(out)))) {
            write(table, dos, ctx);
        }
        log.info("YachtDpTable: {} 저장 완료 ({} bytes)", out, Files.size(out));
    }

    // ── 직렬화 ───────────────────────────────────────────────────────────────

    private static void write(double[] table, DataOutputStream dos, YachtDpContext ctx) throws IOException {
        int magic = magicFor(ctx);
        byte[] buf = new byte[ctx.tableSize * 8];
        ByteBuffer bb = ByteBuffer.wrap(buf).order(ByteOrder.LITTLE_ENDIAN);
        for (double v : table) bb.putDouble(v);

        CRC32 crc = new CRC32();
        crc.update(buf);

        dos.writeInt(magic);
        dos.writeInt(VERSION);
        dos.writeInt(ctx.tableSize);
        dos.writeLong(crc.getValue());
        dos.write(buf);
    }

    private static double[] read(InputStream is, YachtDpContext ctx) throws IOException {
        int expectedMagic = magicFor(ctx);
        DataInputStream dis = new DataInputStream(new BufferedInputStream(is));

        int magic = dis.readInt();
        if (magic != expectedMagic)
            throw new IllegalStateException(
                ctx.binFileName + " 매직넘버 불일치: 0x" + Integer.toHexString(magic)
                + " (expected 0x" + Integer.toHexString(expectedMagic) + ")");
        int version = dis.readInt();
        if (version != VERSION)
            throw new IllegalStateException(ctx.binFileName + " 버전 불일치: " + version);
        int size = dis.readInt();
        if (size != ctx.tableSize)
            throw new IllegalStateException(ctx.binFileName + " 크기 불일치: " + size);

        long storedCrc = dis.readLong();
        byte[] buf = dis.readAllBytes();
        if (buf.length != ctx.tableSize * 8)
            throw new IllegalStateException(ctx.binFileName + " 데이터 크기 불일치: " + buf.length);

        CRC32 crc = new CRC32();
        crc.update(buf);
        if (crc.getValue() != storedCrc)
            throw new IllegalStateException(ctx.binFileName + " CRC32 불일치 — 파일 손상");

        double[] table = new double[ctx.tableSize];
        ByteBuffer bb = ByteBuffer.wrap(buf).order(ByteOrder.LITTLE_ENDIAN);
        for (int i = 0; i < ctx.tableSize; i++) table[i] = bb.getDouble();
        return table;
    }

    // ── MAGIC 계산 ───────────────────────────────────────────────────────────

    /**
     * D6: 0x59445036 ("YDP6"), D8: 0x59445038 ("YDP8").
     * ASCII: Y=0x59, D=0x44, P=0x50, '0'+faces
     */
    private static int magicFor(YachtDpContext ctx) {
        return 0x59445030 | ctx.faces;  // 'Y','D','P', ('0' + faces)
    }

    private YachtDpTable() {}
}
