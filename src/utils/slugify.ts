export function generateSlug(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')  
    .replace(/[\u0300-\u036f]/g, '') 
    .replace(/[^\w\s-]/g, '')   
    .replace(/[\s_-]+/g, '-') 
    .replace(/^-+|-+$/g, '');
}