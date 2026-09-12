type PageResult<T> = { data: T[] | null; error: { message: string } | null };

/** The caller supplies a fresh, consistently ordered query for each page. */
export async function readAllPages<T>(fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>): Promise<T[]> {
  const pageSize = 1000;
  const rows: T[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const result = await fetchPage(offset, offset + pageSize - 1);
    if (result.error) throw new Error(`Could not load CRM data: ${result.error.message}`);
    const page = result.data ?? [];
    for (const row of page) rows.push(row);
    if (page.length < pageSize) return rows;
  }
}
