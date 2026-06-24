/**
 * Reusable layer-config controls (`godam-ve-*`).
 *
 * The standard input fields render real WordPress components
 * (`TextControl`, `TextareaControl`, `RangeControl`) carrying a
 * `godam-ve-control` class; their look is tuned in `_controls.scss` by
 * overriding the `.components-*` internals — the same approach the editor
 * used with `_common.scss`, but with new self-contained classes.
 *
 * Collapsibles use `Panel`/`PanelBody` and radios use `RadioControl` (in the
 * consumer). The remaining bespoke pickers (segmented toggle, layout grid) have
 * no WordPress-component equivalent for their two-line / thumbnail designs, so
 * they stay custom but are likewise classed and styled under `.godam-video-editor`.
 */

/**
 * WordPress dependencies
 */
import { TextControl, TextareaControl, RangeControl, SelectControl, CustomSelectControl, ToggleControl, Icon } from '@wordpress/components';
import { chevronUp, chevronDown } from '@wordpress/icons';
import { useState } from '@wordpress/element';

/**
 * Section wrapper with an optional heading.
 *
 * @param {Object}      props             Props.
 * @param {string}      [props.title]     Heading text.
 * @param {string}      [props.className] Extra class names.
 * @param {JSX.Element} props.children    Section body.
 * @return {JSX.Element} Section element.
 */
export const VeSection = ( { title, className = '', children } ) => (
	<section className={ `godam-ve-section ${ className }`.trim() }>
		{ title && <h3 className="godam-ve-section__title">{ title }</h3> }
		{ children }
	</section>
);

/**
 * Labelled grouping for composite controls that aren't a single WordPress
 * input (e.g. a set of colour rows). Single inputs should instead pass their
 * own `label`/`help` to the underlying WordPress component.
 *
 * @param {Object}      props             Props.
 * @param {string}      [props.label]     Group label.
 * @param {string}      [props.help]      Help text shown below the group.
 * @param {string}      [props.className] Extra class names.
 * @param {JSX.Element} props.children    The grouped controls.
 * @return {JSX.Element} Field element.
 */
export const VeField = ( { label, help, className = '', children } ) => (
	<div className={ `godam-ve-field ${ className }`.trim() }>
		{ label && <span className="godam-ve-field__label">{ label }</span> }
		{ children }
		{ help && <p className="godam-ve-field__help">{ help }</p> }
	</div>
);

/**
 * Single-line text input — WordPress `TextControl` with a `godam-ve-control`
 * class for styling. When `error` is set it takes the place of `help` and is
 * shown in red (with a red input border).
 *
 * @param {Object}   props               Props.
 * @param {string}   [props.label]       Field label.
 * @param {string}   [props.help]        Help text shown below the input.
 * @param {string}   [props.error]       Error message (red); overrides `help`.
 * @param {string}   props.value         Current value.
 * @param {Function} props.onChange      Receives the new string value.
 * @param {string}   [props.placeholder] Placeholder.
 * @param {string}   [props.type]        Input type (default 'text').
 * @param {string}   [props.className]   Extra class names.
 * @return {JSX.Element} Text control.
 */
export const VeTextInput = ( { label, help, error, value = '', onChange, placeholder, type = 'text', className = '', ...rest } ) => (
	<TextControl
		__next40pxDefaultSize
		__nextHasNoMarginBottom
		className={ `godam-ve-control ${ error ? 'is-error' : '' } ${ className }`.trim() }
		label={ label }
		hideLabelFromVision={ ! label }
		help={ error || help }
		type={ type }
		value={ value ?? '' }
		placeholder={ placeholder }
		onChange={ onChange }
		{ ...rest }
	/>
);

/**
 * Multi-line textarea — WordPress `TextareaControl` with a `godam-ve-control`
 * class for styling.
 *
 * @param {Object}   props               Props.
 * @param {string}   [props.label]       Field label.
 * @param {string}   [props.help]        Help text (e.g. character limit).
 * @param {string}   props.value         Current value.
 * @param {Function} props.onChange      Receives the new string value.
 * @param {string}   [props.placeholder] Placeholder.
 * @param {number}   [props.rows]        Visible rows.
 * @param {number}   [props.maxLength]   Character limit.
 * @param {string}   [props.className]   Extra class names.
 * @return {JSX.Element} Textarea control.
 */
export const VeTextarea = ( { label, help, value = '', onChange, placeholder, rows = 4, maxLength, className = '' } ) => (
	<TextareaControl
		__nextHasNoMarginBottom
		className={ `godam-ve-control godam-ve-control--textarea ${ className }`.trim() }
		label={ label }
		hideLabelFromVision={ ! label }
		help={ help }
		rows={ rows }
		value={ value ?? '' }
		placeholder={ placeholder }
		maxLength={ maxLength }
		onChange={ onChange }
	/>
);

/**
 * Range slider — WordPress `RangeControl` with a `godam-ve-control` class for
 * styling.
 *
 * @param {Object}   props             Props.
 * @param {string}   [props.label]     Field label.
 * @param {string}   [props.help]      Help text shown below the slider.
 * @param {number}   props.value       Current value.
 * @param {Function} props.onChange    Receives the new numeric value.
 * @param {number}   [props.min]       Minimum (default 0).
 * @param {number}   [props.max]       Maximum (default 100).
 * @param {number}   [props.step]      Step (default 1).
 * @param {string}   [props.className] Extra class names.
 * @return {JSX.Element} Range control.
 */
export const VeSlider = ( { label, help, value = 0, onChange, min = 0, max = 100, step = 1, className = '' } ) => (
	<RangeControl
		__next40pxDefaultSize
		__nextHasNoMarginBottom
		className={ `godam-ve-control godam-ve-control--range ${ className }`.trim() }
		label={ label }
		hideLabelFromVision={ ! label }
		help={ help }
		value={ value }
		onChange={ onChange }
		min={ min }
		max={ max }
		step={ step }
	/>
);

/**
 * Dropdown select — WordPress `SelectControl` with a `godam-ve-control` class.
 *
 * @param {Object}   props             Props.
 * @param {string}   [props.label]     Field label.
 * @param {string}   [props.help]      Help text shown below the select.
 * @param {string}   props.value       Selected value.
 * @param {Function} props.onChange    Receives the chosen value.
 * @param {Array}    props.options     `[{ label, value }]`.
 * @param {boolean}  [props.disabled]  Whether the control is disabled.
 * @param {string}   [props.className] Extra class names.
 * @return {JSX.Element} Select control.
 */
export const VeSelect = ( { label, help, value, onChange, options = [], disabled = false, className = '' } ) => (
	<SelectControl
		__next40pxDefaultSize
		__nextHasNoMarginBottom
		className={ `godam-ve-control godam-ve-select ${ className }`.trim() }
		label={ label }
		help={ help }
		value={ value }
		options={ options }
		onChange={ onChange }
		disabled={ disabled }
	/>
);

/**
 * Dropdown built on WordPress `CustomSelectControl` (a custom-rendered listbox
 * trigger, unlike the native `<select>` used by `VeSelect`). It exposes the
 * SAME simple `{ label, value }` option API as `VeSelect`: `value` is the
 * option's string `value` and `onChange` receives that string.
 *
 * `CustomSelectControl` has no native `help` or `disabled` props, so both are
 * handled by the wrapper (help rendered below; disabled greys out + blocks
 * pointer events).
 *
 * @param {Object}   props             Props.
 * @param {string}   [props.label]     Field label.
 * @param {string}   [props.help]      Help text shown below the control.
 * @param {string}   props.value       Selected value.
 * @param {Function} props.onChange    Receives the chosen value.
 * @param {Array}    props.options     `[{ label, value }]`.
 * @param {boolean}  [props.disabled]  Whether the control is disabled.
 * @param {string}   [props.className] Extra class names.
 * @return {JSX.Element} Custom select control.
 */
export const VeCustomSelect = ( { label, help, value, onChange, options = [], disabled = false, className = '' } ) => {
	const items = options.map( ( opt ) => ( { key: String( opt.value ), name: opt.label } ) );
	const selected = items.find( ( item ) => item.key === String( value ) ) ?? items[ 0 ];

	return (
		<div className={ `godam-ve-custom-select-field ${ disabled ? 'is-disabled' : '' } ${ className }`.trim() }>
			<CustomSelectControl
				__next40pxDefaultSize
				className="godam-ve-control godam-ve-custom-select"
				label={ label }
				options={ items }
				value={ selected }
				onChange={ ( next ) => onChange?.( next?.selectedItem?.key ) }
			/>
			{ help && <p className="godam-ve-field__help">{ help }</p> }
		</div>
	);
};

/**
 * On/off toggle — WordPress `ToggleControl` with a `godam-ve-control` class.
 *
 * @param {Object}   props             Props.
 * @param {string}   props.label       Toggle label.
 * @param {string}   [props.help]      Help text shown below the toggle.
 * @param {boolean}  props.checked     Current state.
 * @param {Function} props.onChange    Receives the new boolean.
 * @param {boolean}  [props.disabled]  Whether the control is disabled.
 * @param {string}   [props.className] Extra class names.
 * @return {JSX.Element} Toggle control.
 */
export const VeToggle = ( { label, help, checked, onChange, disabled = false, className = '' } ) => (
	<ToggleControl
		__nextHasNoMarginBottom
		className={ `godam-ve-control godam-ve-toggle ${ className }`.trim() }
		label={ label }
		help={ help }
		checked={ checked }
		onChange={ onChange }
		disabled={ disabled }
	/>
);

/**
 * Segmented card toggle (e.g. "Card Style" / "HTML"). Custom — WordPress
 * `ToggleGroupControl` can't render the two-line option design.
 *
 * @param {Object}   props          Props.
 * @param {Array}    props.options  `[{ value, label, description, icon, disabled }]`. `icon` is an optional JSX element rendered above the label.
 *
 * @param {string}   props.value    Selected value.
 * @param {Function} props.onChange Receives the chosen value.
 * @return {JSX.Element} Segmented control.
 */
export const VeSegmented = ( { options = [], value, onChange } ) => (
	<div className="godam-ve-segmented">
		{ options.map( ( opt ) => (
			<button
				key={ opt.value }
				type="button"
				disabled={ opt.disabled }
				aria-pressed={ value === opt.value }
				className={ `godam-ve-segmented__option${ value === opt.value ? ' is-selected' : '' }` }
				onClick={ () => onChange?.( opt.value ) }
			>
				{ opt.icon && (
					<span className="godam-ve-segmented__icon">{ opt.icon }</span>
				) }
				<span className="godam-ve-segmented__title">{ opt.label }</span>
				{ opt.description && (
					<span className="godam-ve-segmented__desc">{ opt.description }</span>
				) }
			</button>
		) ) }
	</div>
);

/**
 * Visual thumbnail grid (e.g. card layout picker). Custom — no WordPress
 * component renders a selectable icon grid.
 *
 * @param {Object}   props          Props.
 * @param {Array}    props.options  `[{ value, label, Icon }]` where `Icon` is a component.
 * @param {string}   props.value    Selected value.
 * @param {Function} props.onChange Receives the chosen value.
 * @return {JSX.Element} Grid control.
 */
export const VeLayoutGrid = ( { options = [], value, onChange } ) => (
	<div className="godam-ve-layout-grid">
		{ options.map( ( opt ) => {
			const ItemIcon = opt.Icon;
			return (
				<button
					key={ opt.value }
					type="button"
					aria-label={ opt.label }
					aria-pressed={ value === opt.value }
					title={ opt.label }
					className={ `godam-ve-layout-grid__item${ value === opt.value ? ' is-selected' : '' }` }
					onClick={ () => onChange?.( opt.value ) }
				>
					{ ItemIcon && <ItemIcon /> }
				</button>
			);
		} ) }
	</div>
);

/**
 * Radio-card group built on native radio inputs. Each option shows a
 * bold label + muted description; the SELECTED option renders its own
 * `content` (e.g. a Start Time / Watch % field) directly beneath it, matching
 * the design. Per-option `disabled` is supported (e.g. a locked "On Pause").
 *
 * (WordPress `RadioControl` can't interleave per-option content, so this stays
 * custom but uses real radio inputs for keyboard/screen-reader support.)
 *
 * @param {Object}   props          Props.
 * @param {string}   props.name     Shared radio group name (unique per layer).
 * @param {Array}    props.options  `[{ value, label, description, disabled, content }]`.
 * @param {string}   props.value    Selected value.
 * @param {Function} props.onChange Receives the chosen value.
 * @return {JSX.Element} Radio group.
 */
export const VeRadioGroup = ( { name, options = [], value, onChange } ) => (
	<div className="godam-ve-radio-group" role="radiogroup">
		{ options.map( ( opt ) => {
			const selected = value === opt.value;
			const optionId = `${ name }-${ opt.value }`;
			return (
				<div
					key={ opt.value }
					className={ `godam-ve-radio${ selected ? ' is-selected' : '' }${ opt.disabled ? ' is-disabled' : '' }` }
				>
					<label className="godam-ve-radio__option" htmlFor={ optionId }>
						<input
							id={ optionId }
							type="radio"
							className="godam-ve-radio__input"
							name={ name }
							value={ opt.value }
							checked={ selected }
							disabled={ opt.disabled }
							onChange={ () => onChange?.( opt.value ) }
						/>
						<span className="godam-ve-radio__text">
							<span className="godam-ve-radio__label">{ opt.label }</span>
							{ opt.description && (
								<span className="godam-ve-radio__desc">{ opt.description }</span>
							) }
						</span>
					</label>
					{ selected && opt.content && (
						<div className="godam-ve-radio__expand">{ opt.content }</div>
					) }
				</div>
			);
		} ) }
	</div>
);

/**
 * Collapsible disclosure section (e.g. "Button Settings", "Advanced") — a
 * self-contained component (divider + bold header toggle with chevron + body),
 * styled via `godam-ve-collapsible`.
 *
 * @param {Object}      props               Props.
 * @param {string}      props.title         Header text.
 * @param {boolean}     [props.defaultOpen] Initial open state (default true).
 * @param {JSX.Element} props.children      Body content.
 * @return {JSX.Element} Collapsible section.
 */
export const VeCollapsible = ( { title, defaultOpen = true, children } ) => {
	const [ open, setOpen ] = useState( defaultOpen );
	return (
		<div className={ `godam-ve-collapsible${ open ? ' is-open' : '' }` }>
			<button
				type="button"
				className="godam-ve-collapsible__head"
				aria-expanded={ open }
				onClick={ () => setOpen( ( value ) => ! value ) }
			>
				<span className="godam-ve-collapsible__title">{ title }</span>
				<Icon className="godam-ve-collapsible__chevron" icon={ open ? chevronUp : chevronDown } />
			</button>
			{ open && (
				<div className="godam-ve-collapsible__body">
					{ children }
				</div>
			) }
		</div>
	);
};

/**
 * Bordered container that groups the colour-picker rows.
 *
 * @param {Object}      props          Props.
 * @param {JSX.Element} props.children `ColorPickerButton` rows.
 * @return {JSX.Element} Colour list.
 */
export const VeColorList = ( { children } ) => (
	<div className="godam-ve-color-list">{ children }</div>
);
