export type PagingInp<Val> = (last: null | any) => Promise<{ next: null | any, page: Val[] }>; // TODO: Support lazy `page`
export default async function*<Next, V>(inp: PagingInp<V>) {
  
  let last: null | Next = null;
  while (true) {
    
    const { next, page } = await inp(last);
    
    if (!page.length) break;
    yield* page;
    
    if (next === null) break;
    last = next;
    
  }
  
};