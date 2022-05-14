import fs from 'fs';
import readline from 'node:readline';

export default class Reader {
  constructor(readonly maxLines: number) {
    if (maxLines <= 0) throw new TypeError('Must be greater then zero');
  }

  read(filename: string): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      if (!fs.existsSync(filename)) {
        reject(new Error(`File not found: ${filename}`));
      } else {
        let result: string[] = [];
        const readLog = readline.createInterface({
          input: fs.createReadStream(filename),
        });
        readLog.on('line', line => {
          result.push(line);
          if (result.length > this.maxLines * 2) {
            result = result.slice(-this.maxLines);
          }
        });
        readLog.on('close', () => {
          resolve(result.slice(-this.maxLines));
        });
      }
    });
  }
}
