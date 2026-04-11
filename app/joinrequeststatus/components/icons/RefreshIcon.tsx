import type { SVGProps } from "react";

export default function RefreshIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="20"
      height="17"
      viewBox="0 0 20 17"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M19.1667 1.66535V6.66535M19.1667 6.66535H14.1667M19.1667 6.66535L15.3 3.03201C14.4044 2.13594 13.2964 1.48135 12.0793 1.12932C10.8623 0.777297 9.57592 0.739305 8.34024 1.01889C7.10455 1.29848 5.95983 1.88654 5.01289 2.72819C4.06594 3.56985 3.34764 4.63767 2.925 5.83201M0.833332 14.9987V9.99868M0.833332 9.99868H5.83333M0.833332 9.99868L4.7 13.632C5.59562 14.5281 6.70364 15.1827 7.92067 15.5347C9.1377 15.8867 10.4241 15.9247 11.6598 15.6451C12.8954 15.3655 14.0402 14.7775 14.9871 13.9358C15.9341 13.0942 16.6524 12.0264 17.075 10.832"
        stroke="currentColor"
        strokeOpacity="0.7"
        strokeWidth="1.66667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
