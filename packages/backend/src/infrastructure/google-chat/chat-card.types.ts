/**
 * Tipos TypeScript del subset de Google Chat API v1 que usamos.
 * Reference: https://developers.google.com/workspace/chat/api/reference/rest/v1/cards
 *
 * Tipamos solo los campos que la UI de Daily Race necesita. Cualquier campo
 * adicional (action, dialog, widget no usado) se ignora deliberadamente.
 */

export interface ChatMessage {
  /** Texto plano de fallback (notification preview, smartwatch, clientes sin cards). */
  text?: string;
  /** Cards interactivas. */
  cardsV2?: ChatCardWithId[];
}

export interface ChatCardWithId {
  cardId: string;
  card: ChatCard;
}

export interface ChatCard {
  header?: CardHeader;
  sections?: Section[];
  sectionDividerStyle?: 'DIVIDER_STYLE_UNSPECIFIED' | 'SOLID_DIVIDER' | 'NO_DIVIDER';
  /** Identifier opaco usado por add-ons (en Chat puro no se navega entre cards). */
  name?: string;
}

export interface CardHeader {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  imageType?: 'SQUARE' | 'CIRCLE';
  imageAltText?: string;
}

export interface Section {
  header?: string;
  widgets: Widget[];
  collapsible?: boolean;
  /** Numero de widgets visibles antes del "Show more" cuando collapsible=true. */
  uncollapsibleWidgetsCount?: number;
}

export type Widget =
  | { textParagraph: TextParagraph }
  | { decoratedText: DecoratedText }
  | { divider: Record<string, never> }
  | { image: ImageWidget }
  | { grid: GridWidget }
  | { columns: Columns }
  | { buttonList: ButtonList };

export interface TextParagraph {
  text: string;
  /** Si se especifica, trunca a N lineas con "Show more". */
  maxLines?: number;
}

export interface DecoratedText {
  startIcon?: Icon;
  endIcon?: Icon;
  topLabel?: string;
  text: string;
  bottomLabel?: string;
  wrapText?: boolean;
  button?: Button;
  onClick?: OnClick;
}

export interface Icon {
  altText?: string;
  imageType?: 'SQUARE' | 'CIRCLE';
  knownIcon?: string;
  iconUrl?: string;
  materialIcon?: MaterialIcon;
}

export interface MaterialIcon {
  name: string;
  /** 100, 200, 300, 400, 500, 600, 700. Default 400. */
  weight?: number;
  /** 0..1. Iconos rellenos vs outline. */
  fill?: number;
  /** -25, 0, 200. */
  grade?: number;
}

export interface ImageWidget {
  imageUrl: string;
  altText?: string;
  onClick?: OnClick;
}

export interface ImageComponent {
  imageUri: string;
  altText?: string;
  cropStyle?: { type: 'SQUARE' | 'CIRCLE' | 'RECTANGLE_CUSTOM' };
  borderStyle?: BorderStyle;
}

export interface BorderStyle {
  type: 'BORDER_STYLE_UNSPECIFIED' | 'NO_BORDER' | 'STROKE';
  strokeColor?: string;
  cornerRadius?: number;
}

export interface GridWidget {
  title?: string;
  columnCount: number;
  borderStyle?: BorderStyle;
  items: GridItem[];
  onClick?: OnClick;
}

export interface GridItem {
  id?: string;
  image?: ImageComponent;
  title?: string;
  subtitle?: string;
  layout?: 'GRID_ITEM_LAYOUT_UNSPECIFIED' | 'TEXT_BELOW' | 'TEXT_ABOVE';
}

export interface Columns {
  columnItems: Column[];
}

export interface Column {
  horizontalSizeStyle?: 'FILL_AVAILABLE_SPACE' | 'FILL_MINIMUM_SPACE';
  horizontalAlignment?: 'START' | 'CENTER' | 'END';
  verticalAlignment?: 'TOP' | 'MIDDLE' | 'BOTTOM';
  widgets: Widget[];
}

export interface ButtonList {
  buttons: Button[];
}

export interface Button {
  text?: string;
  icon?: Icon;
  /** Color en RGB float (0..1) — NO hex. */
  color?: { red: number; green: number; blue: number; alpha?: number };
  onClick: OnClick;
  disabled?: boolean;
  altText?: string;
  type?: 'OUTLINED' | 'FILLED' | 'FILLED_TONAL' | 'BORDERLESS';
}

export type OnClick =
  | { openLink: { url: string } }
  | { action: { function: string; parameters?: { key: string; value: string }[] } };
