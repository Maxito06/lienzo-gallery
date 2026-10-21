import { pageItems } from './pagination';

describe('pageItems', () => {
  it('shows every page when there are seven or fewer', () => {
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('collapses the end with an ellipsis when the current page is near the start', () => {
    expect(pageItems(1, 20)).toEqual([1, 2, 'gap', 20]);
    expect(pageItems(3, 20)).toEqual([1, 2, 3, 4, 'gap', 20]);
  });

  it('collapses both sides when the current page is in the middle', () => {
    expect(pageItems(10, 20)).toEqual([1, 'gap', 9, 10, 11, 'gap', 20]);
  });

  it('collapses the start with an ellipsis when the current page is near the end', () => {
    expect(pageItems(20, 20)).toEqual([1, 'gap', 19, 20]);
    expect(pageItems(18, 20)).toEqual([1, 'gap', 17, 18, 19, 20]);
  });

  it('fills a gap of a single page instead of using an ellipsis', () => {
    expect(pageItems(4, 10)).toEqual([1, 2, 3, 4, 5, 'gap', 10]);
  });
});
