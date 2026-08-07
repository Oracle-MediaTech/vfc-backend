export function addHours(dateString: string, hours: number) {
   const date = new Date(dateString);
   date.setHours(date.getHours() + hours);
   return date;
}
