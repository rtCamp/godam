/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';
import DOMPurify from 'isomorphic-dompurify';

/**
 * WordPress dependencies
 */
import {
	Button,
	Panel,
	PanelBody, CustomSelectControl,
} from '@wordpress/components';
import { chevronRight } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';
import { useState, useEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { updateLayerField } from '../../redux/slice/videoSlice';
import TextCTA from '../cta/TextCTA';
import ImageCTA from '../cta/ImageCTA';
import HtmlCTA from '../cta/HtmlCTA';
import LayerControls from '../LayerControls';
import ColorPickerButton from '../shared/color-picker/ColorPickerButton.jsx';
import LayersHeader from './LayersHeader.js';
import React from 'react';

// A DOMPurify config similar to what wp_kses_post() allows
const wpKsesAllowed = {
	ALLOWED_TAGS: [
		'a', 'abbr', 'acronym', 'b', 'blockquote', 'cite', 'code', 'del', 'em', 'i',
		'q', 'strike', 'strong', 'br', 'p', 'ul', 'ol', 'li', 'span', 'div', 'img',
		'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'hr', 'table', 'thead', 'tbody',
		'tr', 'th', 'td', 'video', 'audio', 'source', 'track', 'button',
	],
	ALLOWED_ATTR: [
		'href', 'title', 'alt', 'src', 'class', 'id', 'style', 'rel', 'target',
		'name', 'width', 'height', 'align',
	],
	ALLOW_DATA_ATTR: false,
};

const CTALayer = ( { layerID, goBack, duration } ) => {
	const [ formHTML, setFormHTML ] = useState( '' );
	const [ imageCtaUrl, setImageCtaUrl ] = useState( '' );
	const dispatch = useDispatch();

	const restURL = window.godamRestRoute.url || '';

	const layer = useSelector( ( state ) =>
		state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ),
	);

	const ctaLayerOptions = [
		{
			name: __( 'Text', 'godam' ),
			key: 'text',
		},
		{
			name: __( 'HTML', 'godam' ),
			key: 'html',
		},
		{
			name: __( 'Image', 'godam' ),
			key: 'image',
		},
	];

	const handleCTATypeSelect = ( val ) => {
		dispatch(
			updateLayerField( {
				id: layer.id,
				field: 'cta_type',
				value: val.selectedItem.key,
			} ),
		);
	};

	const fetchOverlayMediaURL = ( mediaId ) => {
		if ( 0 === mediaId || ! mediaId ) {
			setImageCtaUrl( '' );
			return;
		}
		fetch( window.pathJoin( [ restURL, `/wp/v2/media/${ mediaId }` ] ) )
			.then( ( response ) => {
				if ( ! response.ok ) {
					throw new Error( 'Media not found' );
				}
				return response.json();
			} )
			.then( ( media ) => {
				setImageCtaUrl( media.source_url ); // URL of the media file
			} );
	};

	const renderSelectedCTAInputs = () => {
		switch ( layer?.cta_type ) {
			case 'text':
				return <TextCTA layerID={ layer.id } />;
			case 'image':
				return <ImageCTA layerID={ layer.id } />;
			case 'html':
				return <HtmlCTA layerID={ layer.id } />;
			default:
				return <TextCTA layerID={ layer.id } />;
		}
	};

	const imageCtaHtml = () => {
		return `<div class="${ 'portrait' === layer?.imageCtaOrientation ? 'vertical-image-cta-container' : 'image-cta-container' }">
					<img
						src="${ imageCtaUrl }"
						alt="CTA ad"
						height="300"
						width="250"
						style="opacity: ${ layer?.imageOpacity ?? 1 }"
					/>
					<div class="image-cta-description">
						${ layer?.imageText ? `<h2>${ layer.imageText }</h2>` : '' }
						${ layer?.imageDescription ? `<p>${ layer.imageDescription }</p>` : '' }
						<a class="image-cta-btn" href="${ layer?.imageLink || '/' }" target="_blank">
							${ layer?.imageCtaButtonText || __( 'Buy Now', 'godam' ) }
						</a>
					</div>
   				 </div>`;
	};

	useEffect( () => {
		if ( ! layer ) {
			return;
		}

		if ( 'text' === layer?.cta_type ) {
			setFormHTML( layer.text );
		} else if ( 'html' === layer?.cta_type ) {
			setFormHTML( layer.html );
		} else if ( 'image' === layer?.cta_type ) {
			fetchOverlayMediaURL( layer?.image );
			if ( imageCtaUrl.length !== 0 ) {
				setFormHTML( imageCtaHtml );
			} else {
				setFormHTML( '' );
			}
		}
	}, [ layer, imageCtaUrl ] );

	return (
		<>
			<LayersHeader layer={ layer } goBack={ goBack } duration={ duration } />

			<div className="flex flex-col godam-form-group">
				<p className="mb-4 label-text">{ __( 'Call to Action', 'godam' ) }</p>
				<CustomSelectControl
					__next40pxDefaultSize
					className="mb-4 godam-input"
					label={ __( 'Select type', 'godam' ) }
					onChange={ handleCTATypeSelect }
					options={ ctaLayerOptions }
					value={ ctaLayerOptions.find( ( option ) => option.key === layer.cta_type ) }
				/>

				{ renderSelectedCTAInputs() }

				{ /* Common settings */ }

				<Panel className="-mx-4 border-x-0">
					<PanelBody
						title={ __( 'Advance', 'godam' ) }
						initialOpen={ false }
					>
						{ /* Layer background color */ }
						<label htmlFor="color" className="easydam-label">{ __( 'Color', 'godam' ) }</label>
						<ColorPickerButton
							className="mb-4"
							value={ layer?.bg_color ?? '#FFFFFFB3' }
							label={ __( 'Layer background color', 'godam' ) }
							enableAlpha={ true }
							onChange={ ( value ) => dispatch( updateLayerField( { id: layer.id, field: 'bg_color', value } ) ) }
						/>
					</PanelBody>
				</Panel>

			</div>
			<LayerControls>
				<>
					{ layer?.cta_type === 'text' && (
						<div className="easydam-layer" style={ { backgroundColor: layer.bg_color } }>
							<div className="ql-editor easydam-layer--cta-text" dangerouslySetInnerHTML={ { __html: formHTML } } />
						</div>
					) }
					{ layer?.cta_type === 'html' && (
						<div className="easydam-layer" style={ { backgroundColor: layer.bg_color } }>
							<div className="easydam-layer--cta-html" dangerouslySetInnerHTML={ { __html: DOMPurify.sanitize( formHTML, wpKsesAllowed ) } } />
						</div>
					) }
					{ layer?.cta_type === 'image' && (
						<div className="easydam-layer" style={ { backgroundColor: layer.bg_color } }>
							<div className="image-cta-overlay-container">
								<div className="image-cta-parent-container">
									<div
										className={ layer?.imageCtaOrientation === 'portrait'
											? 'vertical-image-cta-container'
											: 'image-cta-container' }
										dangerouslySetInnerHTML={ { __html: formHTML } }
									/>
								</div>
							</div>
						</div>
					) }
					{ layer.allow_skip && (
						<Button
							className="skip-button"
							variant="primary"
							icon={ chevronRight }
							iconSize="18"
							iconPosition="right"
						>
							{ __( 'Skip', 'godam' ) }
						</Button>
					) }
				</>
			</LayerControls>
		</>
	);
};

export default CTALayer;
