/**
 * WordPress dependencies
 */
import { ColorIndicator, ColorPicker, Dropdown } from '@wordpress/components';
import { useState } from '@wordpress/element';

/**
 * External dependencies
 */

const ColorPickerButton = ( props ) => {
	const {
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
	} = props;

	const [ color, setColor ] = useState( value );

	return (
		<Dropdown
			className={ `w-full ${ className }` }
			popoverProps={ { placement, flip, resize, offset } }
			renderToggle={ ( { isOpen, onToggle } ) => (
				<button
					onClick={ onToggle }
					aria-expanded={ isOpen }
					className={ `w-full border rounded-sm flex items-center p-2 gap-2 ${ contentClassName } ${
						isOpen ? 'bg-gray-100' : 'bg-transparent'
					}` }
				>
					<ColorIndicator colorValue={ color } />
					{ label }
				</button>
			) }
			renderContent={ () => (
				<ColorPicker color={ color } enableAlpha={ enableAlpha }
					onChange={ ( _color ) => {
						setColor( _color );
						if ( onChange ) {
							onChange( _color );
						}
					} }
				/>
			) }
		/>
	);
};

export default ColorPickerButton;
