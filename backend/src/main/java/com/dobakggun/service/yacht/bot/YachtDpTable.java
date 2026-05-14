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

    private static final int    MAGIC        = 0x59445036;  // "YDP6"
    private static final int    VERSION      = 1;
    private static final int    TABLE_SIZE   = YachtDpEngine.TABLE_SIZE;  // 262,144
    private static final String RESOURCE_NAME = "yacht-d6-dp.bin";

    /**
     * classpath에서 테이블 로드 시도.
     * 파일 없거나 손상된 경우 null 반환.
     */
    public static double[] load() {
        var url = YachtDpTable.class.getClassLoader().getResource(RESOURCE_NAME);
        if (url == null) {
            log.info("YachtDpTable: {} 없음 — 사전 계산 필요", RESOURCE_NAME);
            return null;
        }
        try (InputStream is = url.openStream()) {
            double[] table = read(is);
            log.info("YachtDpTable: {} 로드 완료 ({} entries)", RESOURCE_NAME, TABLE_SIZE);
            return table;
        } catch (Exception e) {
            log.warn("YachtDpTable: 로드 실패 ({}) — 재계산 필요", e.getMessage());
            return null;
        }
    }

    /**
     * 테이블을 resourcesDir/yacht-d6-dp.bin 에 저장.
     */
    public static void save(double[] table, Path resourcesDir) throws IOException {
        Path out = resourcesDir.resolve(RESOURCE_NAME);
        try (DataOutputStream dos = new DataOutputStream(
                new BufferedOutputStream(Files.newOutputStream(out)))) {
            write(table, dos);
        }
        log.info("YachtDpTable: {} 저장 완료 ({} bytes)", out, Files.size(out));
    }

    // ── 직렬화 ───────────────────────────────────────────────────────────────

    private static void write(double[] table, DataOutputStream dos) throws IOException {
        byte[] buf = new byte[TABLE_SIZE * 8];
        ByteBuffer bb = ByteBuffer.wrap(buf).order(ByteOrder.LITTLE_ENDIAN);
        for (double v : table) bb.putDouble(v);

        CRC32 crc = new CRC32();
        crc.update(buf);

        dos.writeInt(MAGIC);
        dos.writeInt(VERSION);
        dos.writeInt(TABLE_SIZE);
        dos.writeLong(crc.getValue());
        dos.write(buf);
    }

    private static double[] read(InputStream is) throws IOException {
        DataInputStream dis = new DataInputStream(new BufferedInputStream(is));

        int magic = dis.readInt();
        if (magic != MAGIC)
            throw new IllegalStateException("매직넘버 불일치: 0x" + Integer.toHexString(magic));
        int version = dis.readInt();
        if (version != VERSION)
            throw new IllegalStateException("버전 불일치: " + version);
        int size = dis.readInt();
        if (size != TABLE_SIZE)
            throw new IllegalStateException("크기 불일치: " + size);

        long storedCrc = dis.readLong();
        byte[] buf = dis.readAllBytes();
        if (buf.length != TABLE_SIZE * 8)
            throw new IllegalStateException("데이터 크기 불일치: " + buf.length);

        CRC32 crc = new CRC32();
        crc.update(buf);
        if (crc.getValue() != storedCrc)
            throw new IllegalStateException("CRC32 불일치 — 파일 손상");

        double[] table = new double[TABLE_SIZE];
        ByteBuffer bb = ByteBuffer.wrap(buf).order(ByteOrder.LITTLE_ENDIAN);
        for (int i = 0; i < TABLE_SIZE; i++) table[i] = bb.getDouble();
        return table;
    }

    private YachtDpTable() {}
}
