let lastTimeid: number;

export default function timeid(): string {
  const time = Date.now();
  const last = lastTimeid || time;
  return (lastTimeid = time > last ? time : last + 1).toString(36);
}
