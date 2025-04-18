/**
 * WordPress dependencies
 */
import { ComboboxControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useState } from '@wordpress/element';

function FormSelector( { className, disabled, formID, forms, handleChange } ) {
	const [ form, setForm ] = useState( formID );
	const [ filteredOptions, setFilteredOptions ] = useState( forms );

	const setFormData = ( value ) => {
		setForm( value );
		handleChange( value );
	};

	return (
		<>
			<ComboboxControl
				__next40pxDefaultSize
				__nextHasNoMarginBottom
				label={ __( 'Select form', 'godam' ) }
				className={ `${ className } ${ disabled ? 'disabled' : '' }` }
				value={ form }
				onChange={ setFormData }
				options={ filteredOptions }
				onFilterValueChange={ ( inputValue ) => {
					setFilteredOptions(
						forms.filter( ( _form ) =>
							_form.label
								.toLowerCase()
								.startsWith( inputValue.toLowerCase() ),
						),
					);
				} }
			/>
		</>
	);
}

export default FormSelector;
