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

function Edit( { attributes, setAttributes } ) {
	const { durationFormat } = attributes;
	const blockProps = useBlockProps();

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
