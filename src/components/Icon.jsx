const paths = {
  menu_book:
    'M12 5v15M3 4c3-1 6-1 9 1 3-2 6-2 9-1v15c-3-1-6-1-9 1-3-2-6-2-9-1Z',
  bookmark: 'M6 3h12v18l-6-4-6 4Z',
  library_books: 'M6 3h15v15H6ZM3 6v15h15M9 7h9M9 11h9',
  sync_alt: 'M3 7h17l-4-4M21 17H4l4 4',
  logout: 'M9 3H3v18h6M10 12h11l-4-4M21 12l-4 4',
  error: 'M12 8v5M12 16v.1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  check_circle: 'm7 12 3 3 7-7M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  search: 'm16 16 5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  arrow_forward: 'M3 12h18m-7-7 7 7-7 7',
  refresh: 'M20 7v5h-5M20 12a8 8 0 1 0-2 5',
  add: 'M12 4v16M4 12h16',
  lock: 'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5ZM12 14v3',
}

export default function Icon({ children }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[children] || paths.menu_book} />
    </svg>
  )
}
