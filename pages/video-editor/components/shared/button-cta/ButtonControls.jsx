/**
 * Appearance controls for the Hotspot layer's "Button" style (one set per
 * hotspot): the variant ("Type"), the attention animation and the colours. The
 * label and link inputs stay in `HotspotLayer.js` (they live on the hotspot's
 * `tooltipText` / `link` fields).
 */

/**
 * External dependencies
 */
import { useDispatch, useStore } from 'react-redux';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { useRef, useCallback } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { updateLayerField } from '../../../redux/slice/videoSlice';
import ColorPickerButton from '../color-picker/ColorPickerButton.jsx';

/**
 * Build a hotspot control test id, matching the `godam-hotspot-control-*-<index>`
 * convention the rest of the hotspot panel uses. The index is omitted when the
 * control is not rendered per point.
 *
 * @param {string} name    Control name, e.g. `button-type`.
 * @param {number} [index] Hotspot index.
 * @return {string} The test id.
 */
const testId = ( name, index ) =>
	`godam-hotspot-control-${ name }${ index === undefined ? '' : `-${ index }` }`;
import { VeField, VeColorList, VeSegmented, VeSelect } from '../../controls';
import {
	DEFAULT_BUTTON_BG,
	DEFAULT_BUTTON_TEXT,
	DEFAULT_BUTTON_HOVER_BG,
	DEFAULT_BUTTON_HOVER_TEXT,
} from '../../../../../assets/src/js/godam-player/utils/buttonCtaStyle';

// Attention animations that draw the viewer's eye to a button.
export const ATTENTION_OPTIONS = [
	{ value: 'none', label: __( 'None', 'godam' ) },
	{ value: 'pulse', label: __( 'Pulse', 'godam' ) },
	{ value: 'ripple', label: __( 'Border waves', 'godam' ) },
	{ value: 'glow', label: __( 'Glow', 'godam' ) },
];

// Button variants: a text label, or the label as a die-cut sticker.
export const VARIANT_OPTIONS = [
	{ value: 'text', label: __( 'Text', 'godam' ) },
	{ value: 'sticker', label: __( 'Sticker', 'godam' ) },
];

/**
 * Debounced colour writer for items in a layer array (e.g. `hotspots`).
 *
 * ColorPicker fires on every drag tick, so writes are debounced (150ms). The
 * write lands later, so it is addressed by the item's stable id, not its index:
 * deleting an item (or the whole layer) inside that window must not shift the
 * edit onto a neighbour or dispatch to a layer that no longer exists. Timers are
 * keyed per (item id + field) so editing several colours within the window
 * doesn't make one edit's clearTimeout cancel another, and each flush reads the
 * freshest array from the store (not a stale closure) so near-simultaneous
 * colour edits compose instead of overwriting each other.
 *
 * @param {string} layerID  Layer id.
 * @param {string} arrayKey Layer field holding the items (e.g. 'hotspots').
 * @return {Function} `( index, field, value ) => void`.
 */
export function useDebouncedItemColor( layerID, arrayKey ) {
	const dispatch = useDispatch();
	const store = useStore();
	const timers = useRef( {} );

	return useCallback(
		( index, field, value ) => {
			const findLayer = () => store.getState().videoReducer.layers.find( ( l ) => l.id === layerID );
			const itemId = findLayer()?.[ arrayKey ]?.[ index ]?.id;
			if ( ! itemId ) {
				return;
			}

			const key = `${ itemId }-${ field }`;
			if ( timers.current[ key ] ) {
				clearTimeout( timers.current[ key ] );
			}
			timers.current[ key ] = setTimeout( () => {
				delete timers.current[ key ];

				const liveLayer = findLayer();
				const liveItems = liveLayer?.[ arrayKey ] || [];
				// The layer or item was deleted while the write was pending.
				if ( ! liveItems.some( ( item ) => item.id === itemId ) ) {
					return;
				}

				const next = liveItems.map( ( item ) => ( item.id === itemId ? { ...item, [ field ]: value } : item ) );
				dispatch( updateLayerField( { id: layerID, field: arrayKey, value: next } ) );
			}, 150 );
		},
		[ dispatch, store, layerID, arrayKey ],
	);
}

/**
 * "Type" selector (Text / Sticker).
 *
 * @param {Object}   props          Props.
 * @param {string}   [props.value]  Current variant (defaults to 'text').
 * @param {Function} props.onChange Receives the chosen variant.
 * @param {number}   [props.index]  Hotspot index, used to build the test ids.
 * @return {JSX.Element} The variant field.
 */
export const ButtonVariantField = ( { value, onChange, index } ) => (
	<VeField
		label={ __( 'Type', 'godam' ) }
		data-test-id={ testId( 'button-type', index ) }
	>
		<VeSegmented
			options={ VARIANT_OPTIONS.map( ( opt ) => ( {
				...opt,
				testId: testId( `button-type-${ opt.value }`, index ),
			} ) ) }
			value={ value || 'text' }
			onChange={ onChange }
		/>
	</VeField>
);

/**
 * Attention animation + colour controls for one button.
 *
 * A text button gets background / text / hover colours; a sticker gets a single
 * Fill colour (stored in `bgColor`).
 *
 * @param {Object}   props               Props.
 * @param {Object}   props.button        The hotspot config.
 * @param {Function} props.onFieldChange Receives a partial update, e.g. `{ attention }`.
 * @param {Function} props.onColorChange Receives `( field, value )` for colour edits.
 * @param {number}   [props.index]       Hotspot index, used to build the test ids.
 * @return {JSX.Element} The attention + colour fields.
 */
export const ButtonStyleFields = ( { button, onFieldChange, onColorChange, index } ) => {
	const isSticker = button?.variant === 'sticker';

	const colorRow = ( field, label, fallback ) => (
		<ColorPickerButton
			className="godam-ve-color-row"
			value={ button?.[ field ] ?? fallback }
			label={ label }
			enableAlpha={ true }
			onChange={ ( val ) => onColorChange( field, val ) }
		/>
	);

	return (
		<>
			<VeSelect
				data-test-id={ testId( 'button-attention', index ) }
				label={ __( 'Attention animation', 'godam' ) }
				value={ button?.attention || 'none' }
				options={ ATTENTION_OPTIONS }
				onChange={ ( val ) => onFieldChange( { attention: val } ) }
			/>

			{ ! isSticker && (
				<VeField
					label={ __( 'Colours', 'godam' ) }
					data-test-id={ testId( 'button-colours', index ) }
				>
					<VeColorList>
						{ colorRow( 'bgColor', __( 'Background', 'godam' ), DEFAULT_BUTTON_BG ) }
						{ colorRow( 'textColor', __( 'Text', 'godam' ), DEFAULT_BUTTON_TEXT ) }
						{ colorRow( 'hoverBgColor', __( 'Hover Background', 'godam' ), DEFAULT_BUTTON_HOVER_BG ) }
						{ colorRow( 'hoverTextColor', __( 'Hover Text', 'godam' ), DEFAULT_BUTTON_HOVER_TEXT ) }
					</VeColorList>
				</VeField>
			) }

			{ isSticker && (
				<VeField
					label={ __( 'Fill colour', 'godam' ) }
					data-test-id={ testId( 'button-fill', index ) }
				>
					<VeColorList>
						{ colorRow( 'bgColor', __( 'Fill', 'godam' ), DEFAULT_BUTTON_BG ) }
					</VeColorList>
				</VeField>
			) }
		</>
	);
};
