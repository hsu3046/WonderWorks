// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
// Reproducible ZIP32 archives using only Node's built-in compression and CRC32.
import {open,readFile,mkdir,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {crc32,deflateRawSync} from 'node:zlib';
export async function zipFiles(destination,files){
 await mkdir(dirname(destination),{recursive:true});const temporary=destination+'.building';
 const file=await open(temporary,'w');let offset=0;const central=[];
 async function write(bytes){let written=0;while(written<bytes.length){const result=await file.write(bytes,written,bytes.length-written,offset+written);written+=result.bytesWritten;}offset+=bytes.length;}
 try{
  for(const entry of files){
   const name=Buffer.from(entry.name),data=await readFile(entry.path),compressed=deflateRawSync(data,{level:6}),crc=crc32(data),start=offset;
   const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(8,8);header.writeUInt16LE(33,12);header.writeUInt32LE(crc,14);header.writeUInt32LE(compressed.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(name.length,26);
   await write(header);await write(name);await write(compressed);
   const record=Buffer.alloc(46);record.writeUInt32LE(0x02014b50);record.writeUInt16LE(20,4);record.writeUInt16LE(20,6);record.writeUInt16LE(0x800,8);record.writeUInt16LE(8,10);record.writeUInt16LE(33,14);record.writeUInt32LE(crc,16);record.writeUInt32LE(compressed.length,20);record.writeUInt32LE(data.length,24);record.writeUInt16LE(name.length,28);record.writeUInt32LE(start,42);central.push(record,name);
  }
  const centralStart=offset;for(const bytes of central)await write(bytes);
  const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(offset-centralStart,12);end.writeUInt32LE(centralStart,16);await write(end);
 }finally{await file.close();}
 await rename(temporary,destination);
}
