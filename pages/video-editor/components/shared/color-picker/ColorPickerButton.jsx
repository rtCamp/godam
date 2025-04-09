/**
 * WordPress dependencies
 */
import { ColorIndicator, ColorPicker, Dropdown } from '@wordpress/components';
import { useState, useEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import './color-picker-button.scss';

const ColorPickerButton = ( {
	value = '',
	placement = 'right-end',
	flip = true,
	offset = true,
	enableAlpha = true,
	resize = true,
	label = '',
	className = '',
	contentClassName = '',
	onChange,
	disabled = false,
} ) => {
	const [ color, setColor ] = useState( value );

	useEffect( () => {
		setColor( value );
	}, [ value ] );

	const handleColorChange = ( newColor ) => {
		setColor( newColor );
		onChange?.( newColor );
	};

	return (
		<Dropdown
			className={ `godam-color-picker ${ className } ${ disabled ? 'godam-color-picker--disabled' : '' }` }
			popoverProps={ { placement, flip, resize, offset } }
			renderToggle={ ( { isOpen, onToggle } ) => (
				<button
					type="button"
					onClick={ () => ! disabled && onToggle() }
					aria-expanded={ isOpen }
					className={ `godam-color-picker__toggle ${ isOpen ? 'godam-color-picker__toggle--open' : '' } ${ contentClassName }` }
				>
					<ColorIndicator className="godam-color-picker__indicator" colorValue={ color } />
					<span className="godam-color-picker__label">{ label }</span>
				</button>
			) }
			renderContent={ () => (
				<ColorPicker
					className="godam-color-picker__content"
					color={ color }
					enableAlpha={ enableAlpha }
					onChange={ handleColorChange }
				/>
			) }
		/>
	);
};

export default ColorPickerButton;
