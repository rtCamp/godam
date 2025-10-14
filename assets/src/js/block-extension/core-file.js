
/**
 * External dependencies
 */
import { useEffect } from 'react';

/**
 * WordPress dependencies
 */
import { addFilter } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';
import { Fragment } from '@wordpress/element';
import { InspectorControls } from '@wordpress/block-editor';
import { PanelBody, ToggleControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Add custom attributes to the File block
 *
 * @param {Object} settings - Block settings object.
 * @param {string} name     - Block name.
 * @return {Object} Modified settings object.
 */
function addPDFAttributes( settings, name ) {
	if ( name !== 'core/file' ) {
		return settings;
	}

	return {
		...settings,
		attributes: {
			...settings.attributes,
			showPDFThumbnail: {
				type: 'boolean',
				default: false,
			},
			thumbnailUrl: {
				type: 'string',
				default: '',
			},
		},
	};
}

addFilter(
	'blocks.registerBlockType',
	'custom/file-pdf-attributes',
	addPDFAttributes,
);

/**
 * Add PDF thumbnail toggle control to the File block inspector
 */
const withPDFControls = createHigherOrderComponent( ( BlockEdit ) => {
	return ( props ) => {
		if ( props.name !== 'core/file' ) {
			return <BlockEdit { ...props } />;
		}

		const { attributes, setAttributes } = props;
		const { href, showPDFThumbnail } = attributes;

		// Check if the file is a PDF
		const isPDF = href && href.toLowerCase().endsWith( '.pdf' );

		useEffect( () => {
			// Add the default attribute thumbnailUrl if not present.
			if ( window.godamSelectedItem && window.godamSelectedItem.thumbnail_url ) {
				setAttributes( { thumbnailUrl: window.godamSelectedItem.thumbnail_url } );
			}
		}, [ setAttributes ] );

		return (
			<Fragment>
				<BlockEdit { ...props } />
				{ isPDF && (
					<InspectorControls>
						<PanelBody title={ __( 'PDF Settings', 'textdomain' ) } initialOpen={ true }>
							<ToggleControl
								label={ __( 'Show PDF Thumbnail', 'textdomain' ) }
								checked={ showPDFThumbnail }
								onChange={ ( value ) => setAttributes( { showPDFThumbnail: value } ) }
								help={ __( 'Display a thumbnail preview of the PDF file', 'textdomain' ) }
							/>
						</PanelBody>
					</InspectorControls>
				) }
			</Fragment>
		);
	};
}, 'withPDFControls' );

addFilter(
	'editor.BlockEdit',
	'custom/with-pdf-controls',
	withPDFControls,
);

/**
 * Modify the saved content to include PDF thumbnail
 *
 * @param {Object} element    - Block element.
 * @param {Object} blockType  - Block type object.
 * @param {Object} attributes - Block attributes.
 * @return {Object} Modified block element.
 */
function addPDFThumbnailToSave( element, blockType, attributes ) {
	if ( blockType.name !== 'core/file' ) {
		return element;
	}

	const { href, showPDFThumbnail } = attributes;
	const isPDF = href && href.toLowerCase().endsWith( '.pdf' );

	if ( ! isPDF || ! showPDFThumbnail ) {
		return element;
	}

	// Generate thumbnail URL (assumes PDF thumbnails are generated server-side)
	const thumbnailUrl = href.replace( '.pdf', '-pdf-thumbnail.jpg' );

	return (
		<div className="wp-block-file-with-thumbnail">
			<div className="file-thumbnail">
				<img src={ thumbnailUrl } alt="PDF Thumbnail" />
			</div>
			<div className="file-content">
				{ element }
			</div>
		</div>
	);
}

addFilter(
	'blocks.getSaveElement',
	'custom/add-pdf-thumbnail-save',
	addPDFThumbnailToSave,
);
