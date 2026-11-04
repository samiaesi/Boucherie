/**
 * Réduit une photo choisie par l'admin et la renvoie en data URL JPEG.
 * Les photos sont stockées directement dans Firestore (pas besoin de Firebase Storage).
 * Un document Firestore est limité à 1 Mo : on baisse la qualité, puis la taille,
 * jusqu'à passer sous maxBytes.
 */
export async function resizeImage(file: File, maxSize: number, maxBytes: number): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  for (const scale of [1, 0.8, 0.65, 0.5, 0.35]) {
    const r = Math.min(1, (maxSize * scale) / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.round(bitmap.width * r);
    canvas.height = Math.round(bitmap.height * r);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.75, 0.6, 0.45]) {
      const url = canvas.toDataURL('image/jpeg', quality);
      if (url.length <= maxBytes) {
        bitmap.close();
        return url;
      }
    }
  }
  bitmap.close();
  throw new Error('Cette photo est trop lourde, choisissez-en une autre.');
}
