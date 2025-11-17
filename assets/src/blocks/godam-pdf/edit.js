/**
 * External dependencies
 */
import clsx from 'clsx';

/**
 * WordPress dependencies
 */
import { isBlobURL } from '@wordpress/blob';
import {
	Disabled,
	PanelBody,
	RangeControl,
	Spinner,
	ToggleControl,
} from '@wordpress/components';
import {
	BlockControls,
	BlockIcon,
	InspectorControls,
	MediaPlaceholder,
	MediaReplaceFlow,
	useBlockProps,
} from '@wordpress/block-editor';
import { __ } from '@wordpress/i18n';
import { useDispatch } from '@wordpress/data';
import { store as noticesStore } from '@wordpress/notices';
import { useState } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { Caption } from './caption';
import './editor.scss';
import { ReactComponent as icon } from '../../images/godam-pdf.svg';

const ALLOWED_MEDIA_TYPES = [ 'application/pdf' ];

/**
 * Edit component for the GoDAM PDF block.
 *
 * @param {Object}   props                   - The properties passed to the component.
 * @param {Object}   props.attributes        - The block attributes.
 * @param {string}   props.className         - The class name for the component for styling.
 * @param {Function} props.setAttributes     - Function to update the block's attributes.
 * @param {boolean}  props.isSelected        - Whether the block is currently selected.
 * @param {Function} props.insertBlocksAfter - Function to insert blocks after the current block.
 *
 * @return {JSX.Element} The rendered PDF block component with optional controls and captions.
 */
function PdfEdit( {
	attributes,
	className,
	setAttributes,
	isSelected: isSingleSelected,
	insertBlocksAfter,
} ) {
	const { id, showDownloadButton, showFullScreen, height, src } = attributes;
	const [ temporaryURL, setTemporaryURL ] = useState( attributes.blob );

	function toggleAttribute( attribute ) {
		return ( newValue ) => {
			setAttributes( { [ attribute ]: newValue } );
		};
	}

	const { createErrorNotice } = useDispatch( noticesStore );
	function onUploadError( message ) {
		createErrorNotice( message, { type: 'snackbar' } );
	}

	function onSelectPdf( media ) {
		if ( ! media || ! media.url ) {
			// In this case there was an error and we should continue in the editing state
			// previous attributes should be removed because they may be temporary blob urls.
			setAttributes( {
				src: undefined,
				id: undefined,
				caption: undefined,
				blob: undefined,
			} );
			setTemporaryURL();
			return;
		}

		if ( isBlobURL( media.url ) ) {
			setTemporaryURL( media.url );
			return;
		}

		// Sets the block's attribute and updates the edit component from the
		// selected media, then switches off the editing UI.
		setAttributes( {
			blob: undefined,
			src: media.url,
			id: media.id,
			caption: media.caption,
		} );
		setTemporaryURL();
	}

	const classes = clsx( className, {
		'is-transient': !! temporaryURL,
	} );

	const blockProps = useBlockProps( {
		className: classes,
	} );

	if ( ! src && ! temporaryURL ) {
		return (
			<div { ...blockProps }>
				<MediaPlaceholder
					icon={ <BlockIcon icon={ icon } /> }
					onSelect={ onSelectPdf }
					accept="application/pdf"
					allowedTypes={ ALLOWED_MEDIA_TYPES }
					value={ attributes }
					onError={ onUploadError }
					labels={ { title: __( 'GoDAM PDF', 'godam' ) } }
				/>
			</div>
		);
	}

	return (
		<>
			{ isSingleSelected && (
				<BlockControls group="other">
					<MediaReplaceFlow
						mediaId={ id }
						mediaURL={ src }
						allowedTypes={ ALLOWED_MEDIA_TYPES }
						accept="application/pdf"
						onSelect={ onSelectPdf }
						onError={ onUploadError }
						onReset={ () => onSelectPdf( undefined ) }
					/>
				</BlockControls>
			) }
			<InspectorControls>
				<PanelBody title={ __( 'Settings', 'godam' ) }>
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Show download button', 'godam' ) }
						onChange={ toggleAttribute( 'showDownloadButton' ) }
						checked={ showDownloadButton }
					/>
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Show fullscreen button', 'godam' ) }
						onChange={ toggleAttribute( 'showFullScreen' ) }
						checked={ showFullScreen }
					/>
					<RangeControl
						__nextHasNoMarginBottom
						label={ __( 'Height (px)', 'godam' ) }
						value={ height }
						onChange={ ( value ) =>
							setAttributes( { height: value } )
						}
						min={ 300 }
						max={ 1200 }
						step={ 50 }
					/>
				</PanelBody>
			</InspectorControls>
			<figure { ...blockProps }>
				{ /*
				Disable the embed if the block is not selected
				so the user clicking on it won't interact with the PDF.
				*/ }
				<Disabled isDisabled={ ! isSingleSelected }>
					<div className="godam-pdf-preview" style={ { height: `${ height }px` } }>
						<embed
							src={ src ?? temporaryURL }
							type="application/pdf"
							width="100%"
							height="100%"
						/>
					</div>
				</Disabled>
				{ !! temporaryURL && <Spinner /> }
				<Caption
					attributes={ attributes }
					setAttributes={ setAttributes }
					isSelected={ isSingleSelected }
					insertBlocksAfter={ insertBlocksAfter }
					label={ __( 'PDF caption text', 'godam' ) }
					showToolbarButton={ isSingleSelected }
				/>
			</figure>
		</>
	);
}

export default PdfEdit;
