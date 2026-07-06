/**
 * External dependencies
 */
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import DOMPurify from 'isomorphic-dompurify';

/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';
import { chevronRight } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';
import { useState, useEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { updateLayerField } from '../../redux/slice/videoSlice';
import CardCTA from '../cta/CardCTA';
import HtmlCTA from '../cta/HtmlCTA';
import LayerControls from '../LayerControls';
import ColorPickerButton from '../shared/color-picker/ColorPickerButton.jsx';
import LayersHeader from './LayersHeader.js';
import TriggerSection from './shared/TriggerSection.jsx';
import { VeSection, VeField, VeSegmented, VeCollapsible } from '../controls';

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

	const restURL = window.godamRestRoute?.url || window.wpApiSettings?.root || '/wp-json/';

	const layer = useSelector( ( state ) =>
		state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ),
	);

	// Two CTA styles in the new design: a card builder and a raw-HTML editor.
	const ctaTypeOptions = [
		{ value: 'image', label: __( 'Card Style', 'godam' ), description: __( 'Perfect for everyone', 'godam' ), testId: 'godam-cta-control-type-image' },
		{ value: 'html', label: __( 'HTML', 'godam' ), description: __( 'Great for developers', 'godam' ), testId: 'godam-cta-control-type-html' },
	];

	// Normalize legacy / unknown types (e.g. the removed "text" type) to "image".
	const ctaType = layer?.cta_type === 'html' ? 'html' : 'image';

	const handleCTATypeSelect = ( val ) => {
		dispatch( updateLayerField( { id: layer.id, field: 'cta_type', value: val } ) );
	};

	const fetchOverlayMediaURL = ( mediaId ) => {
		if ( 0 === mediaId || ! mediaId ) {
			setImageCtaUrl( '' );
			return;
		}

		// Handle GoDAM hosted media.
		if ( typeof mediaId === 'string' && mediaId.startsWith( 'godam_' ) ) {
			if ( layer?.imageUrlExt ) {
				setImageCtaUrl( layer.imageUrlExt );
			} else {
				setImageCtaUrl( '' );
			}
			return;
		}

		// For regular WordPress media, fetch from the API
		fetch( window.pathJoin( [ restURL, `/wp/v2/media/${ mediaId }` ] ) )
			.then( ( response ) => {
				if ( ! response.ok ) {
					throw new Error( 'Media not found' );
				}
				return response.json();
			} )
			.then( ( media ) => {
				setImageCtaUrl( media.source_url );
			} )
			.catch( () => {
				setImageCtaUrl( '' );
			} );
	};

	const renderImageCTA = () => {
		const layout = layer?.cardLayout || 'card-layout--text-imagecover';
		const hasImage = imageCtaUrl && imageCtaUrl !== '';
		const opacity = layer?.imageOpacity ?? 1;

		const imageElement = hasImage ? (
			<img src={ imageCtaUrl } alt="CTA Card" style={ { opacity } } />
		) : (
			<div className="godam-cta-card-image-placeholder" style={ { opacity } }>
				{ __( 'No Image', 'godam' ) }
			</div>
		);

		const contentElement = (
			<div className="godam-cta-card-content">
				{ layer?.imageText && <h2 className="card-title">{ layer.imageText }</h2> }
				{ layer?.imageDescription && <p className="card-description">{ layer.imageDescription }</p> }
				{ ( layer?.imageCtaButtonText || layer?.imageLink ) && (
					<div className="btns">
						<a
							className="godam-cta-btn"
							href={ layer?.imageLink || '#' }
							target="_blank"
							rel="noreferrer"
							style={ {
								color: layer?.imageCtaButtonTextColor ?? '#ffffff',
								backgroundColor: layer?.imageCtaButtonColor ?? '#000',
								textDecoration: 'none',
							} }
						>
							{ layer?.imageCtaButtonText || __( 'Check now', 'godam' ) }
						</a>
					</div>
				) }
			</div>
		);

		if ( layout === 'desktop-text-only' ) {
			return contentElement;
		}

		if ( layout === 'card-layout--image-background' ) {
			return (
				<>
					<div
						className="godam-cta-card-image-bg"
						style={ { backgroundImage: `url('${ imageCtaUrl }')`, opacity } }
					/>
					{ contentElement }
				</>
			);
		}

		const imageContent = <div className="godam-cta-card-image">{ imageElement }</div>;
		const textMediaLayerouts = [ 'card-layout--text-imagecover', 'card-layout--text-image', 'card-layout--image-bottom' ];

		if ( textMediaLayerouts.includes( layout ) ) {
			return (
				<>
					{ contentElement }
					{ imageContent }
				</>
			);
		}

		return (
			<>
				{ imageContent }
				{ contentElement }
			</>
		);
	};

	// Migrate legacy / removed CTA types (e.g. the deprecated "text" type) to
	// "image" so the stored value stays consistent with what the editor and the
	// frontend can render.
	useEffect( () => {
		if ( layer && layer.cta_type !== 'image' && layer.cta_type !== 'html' ) {
			dispatch( updateLayerField( { id: layer.id, field: 'cta_type', value: 'image' } ) );
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ layer?.id ] );

	useEffect( () => {
		if ( ! layer ) {
			return;
		}

		if ( 'html' === layer?.cta_type ) {
			setFormHTML( layer.html );
		}
	}, [ layer ] );

	// Fetch the media URL when the image ID changes
	useEffect( () => {
		if ( 'html' !== ctaType && layer?.image && layer?.image !== 0 ) {
			fetchOverlayMediaURL( layer.image );
		} else {
			setImageCtaUrl( '' );
		}
	}, [ ctaType, layer?.image ] );

	return (
		<>
			<LayersHeader layer={ layer } goBack={ goBack } duration={ duration } />

			<div className="godam-ve-config">
				<VeSection title={ __( 'Call To Action', 'godam' ) }>
					<VeSegmented
						options={ ctaTypeOptions }
						value={ ctaType }
						onChange={ handleCTATypeSelect }
					/>
				</VeSection>

				{ ctaType === 'html' ? (
					<>
						<HtmlCTA layerID={ layer.id } />
						<TriggerSection layerID={ layer.id } duration={ duration } />
					</>
				) : (
					<CardCTA
						layerID={ layer.id }
						triggerSlot={ <TriggerSection layerID={ layer.id } duration={ duration } /> }
					/>
				) }

				<VeCollapsible title={ __( 'Advanced', 'godam' ) } defaultOpen={ false }>
					<VeField label={ __( 'Layer Background Colour', 'godam' ) }>
						<ColorPickerButton
							value={ layer?.bg_color ?? '#FFFFFFB3' }
							label={ __( 'Layer background color', 'godam' ) }
							enableAlpha={ true }
							onChange={ ( value ) => dispatch( updateLayerField( { id: layer.id, field: 'bg_color', value } ) ) }
						/>
					</VeField>
				</VeCollapsible>
			</div>

			<LayerControls>
				<>
					{ ctaType === 'html' && (
						<div className="easydam-layer" style={ { backgroundColor: layer.bg_color } }>
							<div className="easydam-layer--cta-html" dangerouslySetInnerHTML={ { __html: DOMPurify.sanitize( formHTML, wpKsesAllowed ) } } />
						</div>
					) }
					{ ctaType === 'image' && (
						<div className="easydam-layer" style={ { backgroundColor: layer.bg_color } }>
							<div className="godam-cta-overlay-container">
								<div
									className={ `godam-cta-card ${ layer?.cardLayout || ( ( ! layer?.imageCtaOrientation || layer?.imageCtaOrientation === 'landscape' ) ? 'card-layout--image-text' : 'card-layout--image-top' ) }` }
									style={ { '--image-width': `${ layer?.imageWidth ?? 50 }%` } }
								>
									{ renderImageCTA() }
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
							{ layer?.trigger === 'end_of_video' ? __( 'Done', 'godam' ) : __( 'Skip', 'godam' ) }
						</Button>
					) }
				</>
			</LayerControls>
		</>
	);
};

export default CTALayer;
