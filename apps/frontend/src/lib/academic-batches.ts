export const ACADEMIC_BATCH_OPTIONS = Array.from({ length: 25 }, (_, i) => {
  const startYear = 15 + i;
  const endYear = startYear + 1;

  return `${startYear.toString().padStart(2, '0')}/${endYear.toString().padStart(2, '0')}`;
});
