import React from 'react';

type Props = {
  className?: string;
  // height?: number | string;
  // width?: number | string;
  style?: React.CSSProperties;
} & React.SVGProps<SVGSVGElement>;

export const Darwin = (props: Props) => (
  <svg xmlns="http://www.w3.org/2000/svg" aria-label="macOS" viewBox="0 0 512 512" {...props}>
    <rect width={512} height={512} rx="15%" fill="#fff" />
    <path d="M282 170v-4c-52 0-5 34 0 4zm24-18c7-21 43-23 47 3h-10c-3-15-28-16-28 11 0 15 23 24 28 6h10c-6 33-59 21-47-20zm-146-16h10v9c5-12 27-13 31 1 7-15 35-14 35 7v37h-11v-34c0-15-22-15-22 1v33h-11v-35c-2.447-9.36-14.915-11.23-20-3l-2 5v33h-10zm23 259c-47 0-76-33-76-86s29-85 76-85 77 33 77 85-29 86-77 86zm88-205c-29 7-33-30-3-31l14-1v-4c1-12-19-13-22-2h-10a14 14 0 012-7c8-14 41-14 41 8v37h-10v-9a18 18 0 01-12 9zm68 205c-36-2-61-19-63-49h24c23 72 146-5 25-30-19-4-33-13-39-24-38-74 109-96 113-20h-23c-7-49-98-22-65 12 14 14 43 13 64 22 50 23 26 91-36 89zM183 245c-32 0-52 25-52 64s20 64 52 64 53-24 53-64-20-64-53-64z" />
  </svg>
);

export const Linux = (props: Props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Linux"
    viewBox="0 0 512 512"
    fill="#333"
    {...props}
  >
    <rect width={512} height={512} rx="15%" fill="#fff" />
    <path d="M192 206c-6 14-48 58-44 102 16 184 72 60 156 106 0 0 150-84 30-220-34-48-4-86-26-118s-60-34-88-4 12 74-28 134" />
    <path
      d="M340 298s18-36-16-62c32 34 12 64 12 64h-6c-2-70-20-32-46-156 30-34-28-64-28-8h-18c2-48-40-24-16 10-2 74-46 104-46 156-14-36 12-64 12-64s-36 30-14 74 62 34 34 54c44 30 112 10 110-54 2-16 44-10 48-6s-6-8-26-8M228 142c-14-4-10-22-4-22s16 14 4 22m38 2c-10-14-2-28 8-26s10 26-8 26"
      fill="#eee"
    />
    <g fill="#fc2" stroke="#333">
      <path
        d="M174 318l42 60c22 14 10 70-50 42-34-10-62-8-66-26s8-20 6-28c-8-44 28-22 38-44s10-32 30-4m224 28c-8-12 0-34-28-32-12 24-46 48-48 0-20 0-6 48-14 70-18 54 34 58 56 32l52-36c4-6 10-12-18-34M214 162c-6-12 22-28 32-28s24 8 38 12 8 18 4 20-26 20-42 20-20-16-32-24M214 160c16 12 34 22 70-6"
        strokeWidth={2}
      />
    </g>
    <path d="M236 148c-4 0 2-4 4-2m14 2c2-2-2-4-6-2" />
  </svg>
);

export const Windows = (props: Props) => (
  <svg xmlns="http://www.w3.org/2000/svg" aria-label="Windows" viewBox="0 0 512 512" {...props}>
    <rect width={512} height={512} rx="15%" fill="#00adef" />
    <path
      fill="#fff"
      d="M98 145l127-18v123H98m142-125l168-24v148H240M98 263h127v123L98 368m142-104h168v147l-168-24"
    />
  </svg>
);

const Platform = ({ platform, ...props }: Props & { platform?: string }) => {
  switch (platform) {
    case 'darwin':
      return <Darwin {...props} />;
    case 'win32':
      return <Windows {...props} />;
    case 'linux':
      return <Linux {...props} />;
    default:
      return null;
  }
};

export default Platform;
