import 'styled-components';
import type { AppTheme } from './theme';

// Give props.theme full type-checking inside every styled template literal.
declare module 'styled-components' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface DefaultTheme extends AppTheme {}
}
