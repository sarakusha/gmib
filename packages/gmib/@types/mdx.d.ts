/*
 * @license
 * Copyright (c) 2020. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "mcd" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

declare module '*.md' {
  let MDXComponent: (props: any) => JSX.Element;
  export default MDXComponent;
}

declare module '*.mdx' {
  let MDXComponent: (props: any) => JSX.Element;
  export default MDXComponent;
}
