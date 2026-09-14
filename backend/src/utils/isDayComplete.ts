export function isDayComplete(day: any): boolean {
  return (
    day &&
    typeof day.date === "string" &&
    Array.isArray(day.activities) &&
    day.activities.length > 0
  );
}
