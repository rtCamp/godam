/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import {
	useBlockProps,
	InspectorControls,
} from '@wordpress/block-editor';
import {
	PanelBody,
	SelectControl,
} from '@wordpress/components';

/**
 * Edit component for the GoDAM Video Duration Block.
 *
 * Provides a settings panel with a dropdown to select the duration format.
 *
 * @param {Object}   props               - The properties passed to the component.
 * @param {Object}   props.attributes    - The block attributes.
 * @param {Function} props.setAttributes - Function to update the block's attributes.
 *
 * @return {JSX.Element} Video Duration placeholder display.
 */
function Edit( { attributes, setAttributes } ) {
	const { durationFormat } = attributes;
	const blockProps = useBlockProps();

	// Duration formats.
	const durationOptions = [
		{
			value: 'default',
			label: __( 'Default (HH:MM:SS)', 'godam' ),
			placeholder: __( '00:00:00', 'godam' ),
		},
		{
			value: 'minutes',
			label: __( 'Minutes only (MM:SS)', 'godam' ),
			placeholder: __( '00:00', 'godam' ),
		},
		{
			value: 'seconds',
			label: __( 'Total Seconds', 'godam' ),
			placeholder: __( '0s', 'godam' ),
		},
	];

	return (
		<>
			<InspectorControls>
				<PanelBody title={ __( 'Duration Settings', 'godam' ) }>
					<SelectControl
						label={ __( 'Duration Format', 'godam' ) }
						value={ durationFormat }
						options={ durationOptions }
						onChange={ ( value ) => setAttributes( { durationFormat: value } ) }
					/>
				</PanelBody>
			</InspectorControls>
			<div { ...blockProps }>
				<p className="godam-duration-preview">
					<span>
						{ durationOptions.find( ( option ) => option.value === durationFormat )?.placeholder || __( '00:00:00', 'godam' ) }
					</span>
				</p>
			</div>
		</>
	);
}

export default Edit;
