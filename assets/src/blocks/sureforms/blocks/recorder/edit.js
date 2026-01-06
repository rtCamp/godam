/**
 * External dependencies
 */
import clsx from 'clsx';

/**
 * WordPress dependencies
 */
import { useEffect, useState } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import {
	CheckboxControl,
	TextControl,
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis
	__experimentalText as Text,
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis
	__experimentalNumberControl as NumberControl,
	ToggleControl,
	PanelBody,
	Notice,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { InspectorControls, RichText, useBlockProps } from '@wordpress/block-editor';

/**
 * Internal dependencies
 */
import {
	useGetCurrentFormId,
	useErrMessage,
	getMaxFileSize,
} from '../../utils';

/**
 * Edit function for the block.
 *
 * @param {Object} props The Component props.
 */
export default function Edit( props ) {
	const { clientId, attributes, setAttributes, className } = props;
	const {
		blockId,
		label,
		description,
		recordButton,
		formId,
		required,
		fileSelector,
		maxFileSize,
		errorMsg,
		blockIndex,
	} = attributes;
	const currentFormId = useGetCurrentFormId( clientId );

	/**
	 * Set notice select file selector at least min.
	 */
	const [ notice, setNotice ] = useState( false );

	const classes = clsx( className, {
		'godam-srfm-recorder': true,
		'srfm-block': true,
	} );

	const blockProps = useBlockProps( {
		className: classes,
	} );

	const maxFileSizeLimit = getMaxFileSize();
	const isRequired = required ? ' srfm-required' : '';

	useEffect( () => {
		if ( formId !== currentFormId ) {
			setAttributes( { formId: currentFormId } );
		}
	}, [ formId, setAttributes, currentFormId ] );

	useEffect( () => {
		setAttributes( { blockId: clientId.substring( 0, 8 ) } );
	}, [ clientId, setAttributes ] );

	/**
	 * Set file selectors.
	 */
	useEffect( () => {
		if ( 0 === fileSelector.length ) {
			setAttributes( { fileSelector: [ 'webcam', 'screen_capture' ] } );
		}
	} );

	const {
		// eslint-disable-next-line no-unused-vars
		currentMessage: currentErrorMsg,
		setCurrentMessage: setCurrentErrorMsg,
	} = useErrMessage( errorMsg );

	/**
	 * Calculate block index.
	 */
	const currentBlockIndex = useSelect( ( select ) => {
		const { getBlocks } = select( 'core/block-editor' );
		const allBlocks = getBlocks();

		const blocksOfTypeRecorder = allBlocks.filter(
			( block ) => block.name === 'godam/srfm-recorder',
		);

		const index = blocksOfTypeRecorder.findIndex(
			( block ) => block.clientId === clientId,
		);

		return index;
	}, [ clientId ] );

	// Update the block index.
	useEffect( () => {
		if ( blockIndex !== currentBlockIndex + 1 ) {
			setAttributes( { blockIndex: currentBlockIndex + 1 } );
		}
	}, [ blockIndex, currentBlockIndex, setAttributes ] );

	/**
	 * File selector option.
	 *
	 * @param {string} value
	 */
	const updateFileSelector = ( value ) => {
		let updated = [];

		if ( fileSelector.includes( value ) ) {
			updated = fileSelector.filter( ( item ) => item !== value );
		} else {
			updated = [ ...fileSelector, value ];
		}

		if ( 0 === updated.length ) {
			setNotice( true );
			return;
		}

		if ( notice ) {
			setNotice( false );
		}

		setAttributes( { fileSelector: updated } );
	};

	/**
	 * Check for file selector.
	 *
	 * @param {string} value
	 */
	const checkFileSelector = ( value ) => {
		return fileSelector.includes( value );
	};

	/**
	 * Inspector Control options.
	 */
	const fieldOptions = [
		{
			id: 'label',
			component: (
				<TextControl
					placeholder={ __( 'Enter label', 'godam' ) }
					__next40pxDefaultSize
					label={ __( 'Label', 'godam' ) }
					help={ __( 'Enter label for the field', 'godam' ) }
					onChange={ ( value ) => {
						setAttributes( { label: value } );
					} }
					value={ label }
				/>
			),
		},
		{
			id: 'description',
			component: (
				<TextControl
					placeholder={ __( 'Enter description', 'godam' ) }
					__next40pxDefaultSize
					label={ __( 'Description', 'godam' ) }
					help={ __( 'Enter description for the field', 'godam' ) }
					onChange={ ( value ) => {
						setAttributes( { description: value } );
					} }
					value={ description }
				/>
			),
		},
		{
			id: 'file-selector',
			component: (
				<>
					<Text isBlock style={ { marginBottom: '20px' } }>
						{ __( 'Choose file selector', 'godam' ) }
					</Text>
					{
						notice &&
						<div style={ { marginBottom: '16px' } }>
							<Notice
								isDismissible={ true }
								onDismiss={ () => setNotice( false ) }
								status="error"
							>
								{ __( 'Select min of 1 file selector' ) }
							</Notice>
						</div>
					}
					<CheckboxControl
						__nextHasNoMarginBottom
						label={ __( 'Local files', 'godam' ) }
						checked={ checkFileSelector( 'file_input' ) }
						onChange={ () => updateFileSelector( 'file_input' ) }
					/>
					<CheckboxControl
						__nextHasNoMarginBottom
						label={ __( 'Webcam', 'godam' ) }
						checked={ checkFileSelector( 'webcam' ) }
						onChange={ () => updateFileSelector( 'webcam' ) }
					/>
					<CheckboxControl
						__nextHasNoMarginBottom
						label={ __( 'Screencast', 'godam' ) }
						checked={ checkFileSelector( 'screen_capture' ) }
						onChange={ () => updateFileSelector( 'screen_capture' ) }
					/>
					<CheckboxControl
						__nextHasNoMarginBottom
						label={ __( 'Audio', 'godam' ) }
						checked={ checkFileSelector( 'audio' ) }
						onChange={ () => updateFileSelector( 'audio' ) }
					/>
				</>
			),
		},
		{
			id: 'max-file-size',
			component: (
				<NumberControl
					__next40pxDefaultSize
					__nextHasNoMarginBottom
					placeholder={ __( '100 MB', 'godam' ) }
					label={ __( 'Maximum file size (in MB)', 'godam' ) }
					help={ sprintf(
						// Translators: %s will be replaced with the maximum file upload size allowed on the server (e.g., "300MB").
						__( 'Maximum allowed on this server: %s MB', 'godam' ),
						maxFileSizeLimit,
					) }
					onChange={ ( value ) => {
						setAttributes( { maxFileSize: parseInt( value, 10 ) } );
					} }
					max={ maxFileSizeLimit }
					step={ 1 }
					min={ 10 }
					value={ parseInt( maxFileSize, 10 ) }
				/>
			),
		},
		{
			id: 'required',
			component: (
				<ToggleControl
					checked={ required }
					label={ __( 'Is recorder field required?', 'godam' ) }
					onChange={ () => setAttributes( { required: ! required } ) }
				/>
			),
		},
		{
			id: 'error-message',
			component: required ? (
				<TextControl
					placeholder={ __( 'Enter error message', 'godam' ) }
					label={ __( 'Required Error Message' ) }
					__next40pxDefaultSize
					__nextHasNoMarginBottom
					help={ __( 'Enter the required error message', 'godam' ) }
					value={ currentErrorMsg }
					onChange={ ( value ) => {
						setCurrentErrorMsg( value );
						setAttributes( { errorMsg: value } );
					} }
				/>
			) : null,
		},
	];

	return (
		<>
			<div { ...blockProps }>
				<InspectorControls>
					<PanelBody title={ __( 'Field settings', 'godam' ) }>
						{ fieldOptions.map( ( option ) => option.component ) }
					</PanelBody>
				</InspectorControls>
				<>
					<RichText
						tagName="label"
						value={ '' === label ? __( 'Untitled', 'godam' ) : label }
						onChange={ ( value ) => {
							setAttributes( { label: value } );
						} }
						className={ `srfm-block-label${ isRequired }` }
						id={ blockId + '-label' }
						multiline={ false }
						allowedFormats={ [] }
					/>
					{
						description ? <RichText
							tagName="label"
							value={ description }
							onChange={ ( value ) => {
								setAttributes( { description: value } );
							} }
							className="srfm-description"
							id={ blockId }
							multiline={ false }
							allowedFormats={ [] }
						/> : null
					}
					<button
						style={ {
							margin: '4px 0',
						} }
						className="srfm-button"
					>
						<RichText
							type="label"
							value={ recordButton ?? __( 'Start Recording', 'godam' ) }
							onChange={ ( value ) => {
								setAttributes( { recordButton: value } );
							} }
							className="godam-srf-record-button"
							multiline={ false }
							allowedFormats={ [] }
						/>
					</button>
					<p className="srfm-description">
						{ sprintf(
							// Translators: %s will be replaced with the maximum file upload size allowed on the server (e.g., "300MB").
							__( 'Maximum allowed size: %s MB', 'godam' ), isNaN( maxFileSize ) || undefined === maxFileSize ? maxFileSizeLimit : maxFileSize ) }
					</p>
				</>
			</div>
		</>
	);
}
