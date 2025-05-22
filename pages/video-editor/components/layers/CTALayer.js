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
	Modal,
	SelectControl,
	Panel,
	PanelBody,
	Notice,
	TextControl,
} from '@wordpress/components';
import { arrowLeft, chevronRight, trash } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';
import { useState, useEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { removeLayer, updateLayerField } from '../../redux/slice/videoSlice';
import TextCTA from '../cta/TextCTA';
import ImageCTA from '../cta/ImageCTA';
import HtmlCTA from '../cta/HtmlCTA';
import LayerControls from '../LayerControls';
import ColorPickerButton from '../shared/color-picker/ColorPickerButton.jsx';

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
	const [ isOpen, setOpen ] = useState( false );
	const [ formHTML, setFormHTML ] = useState( '' );
	const [ imageCtaUrl, setImageCtaUrl ] = useState( '' );
	const [ isEditing, setIsEditing ] = useState( false );
	const [ initialTimePeriod, setInitialTimePeriod ] = useState( '' );
	const dispatch = useDispatch();

	const restURL = window.godamRestRoute.url || '';

	const layer = useSelector( ( state ) =>
		state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ),
	);
	const [ layerTime, setLayerTime ] = useState( layer?.id );
	const handleDeleteLayer = () => {
		dispatch( removeLayer( { id: layer.id } ) );
		goBack();
	};

	const handleCTATypeSelect = ( val ) => {
		dispatch(
			updateLayerField( {
				id: layer.id,
				field: 'cta_type',
				value: val,
			} ),
		);
	};

	const layers = useSelector( ( state ) => state.videoReducer.layers );

	useEffect( () => {
		setLayerTime( layer?.displayTime );
		setInitialTimePeriod( layer?.displayTime );
	}, [] );

	const isDuplicateTime = layers?.some(
		( singleLayer ) =>
			Number( singleLayer.displayTime ) === Number( layerTime ) &&
      singleLayer?.id !== layer?.id,
	);

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
						style="opacity: ${ layer?.imageOpacity || 1 }"
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
			<div>
				<div className="flex justify-between items-center border-b mb-3">
					<Button icon={ arrowLeft } onClick={ goBack } />
					<p className="text-base flex items-center gap-1">{ __( 'CTA layer at', 'godam' ) }
						{ isEditing ? (
							<TextControl
								__nextHasNoMarginBottom={ true }
								__next40pxDefaultSize={ false }
								value={ layerTime }
								style={ { width: 60, height: 20 } }
								onClick={ ( e ) => e.stopPropagation() }
								type="number"
								onChange={ ( value ) => {
									// Remove leading zeros
									let normalizedValue = value.replace( /^0+(?=\d)/, '' );

									// Limit to 2 decimal places
									if ( normalizedValue.includes( '.' ) ) {
										const [ intPart, decimalPart ] = normalizedValue.split( '.' );
										normalizedValue = intPart + '.' + decimalPart.slice( 0, 2 );
									}

									// Convert to number for validation
									const floatValue = parseFloat( normalizedValue );

									if ( floatValue > duration ) {
										return;
									}

									// Reject empty or over-duration values
									if ( normalizedValue === '' || isNaN( floatValue ) ) {
										setLayerTime( normalizedValue );
										dispatch( updateLayerField( {
											id: layer.id,
											field: 'displayTime',
											value: initialTimePeriod,
										} ) );
										return;
									}

									setLayerTime( normalizedValue );

									// Check for duplicate timestamp
									const isTimestampExists = layers?.some(
										( singleLayer ) =>
											Number( singleLayer.displayTime ) === floatValue &&
																			singleLayer?.id !== layer?.id,
									);

									if ( isTimestampExists ) {
										dispatch( updateLayerField( {
											id: layer.id,
											field: 'displayTime',
											value: initialTimePeriod,
										} ) );
									} else {
										dispatch( updateLayerField( {
											id: layer.id,
											field: 'displayTime',
											value: normalizedValue,
										} ) );
									}
								} }
								min={ 0 }
								max={ duration }
								step={ 0.1 }
							/>
						) : (
							<button
								onClick={ () => setIsEditing( true ) }
								className="cursor-pointer bg-transparent text-inherit p-0"
							>
								{ layer.displayTime }s
							</button>
						) }
					</p>
					<Button icon={ trash } isDestructive onClick={ () => setOpen( true ) } />
					{ isOpen && (
						<Modal title={ __( 'Delete layer', 'godam' ) } onRequestClose={ () => setOpen( false ) }>
							<div className="flex justify-between items-center gap-3">
								<Button className="w-full justify-center" isDestructive variant="primary" onClick={ handleDeleteLayer }>
									{ __( 'Delete layer', 'godam' ) }
								</Button>
								<Button className="w-full justify-center" variant="secondary" onClick={ () => setOpen( false ) }>
									{ __( 'Cancel', 'godam' ) }
								</Button>
							</div>
						</Modal>
					) }
				</div>

				{ isDuplicateTime && isEditing && <Notice
					className="mb-4"
					status="error"
					isDismissible={ false }
				>
					{ __( 'A layer already exists at this timestamp!', 'godam' ) }
				</Notice>
				}
				{
					isEditing && '' === layerTime && <Notice
						className="mb-4"
						status="error"
						isDismissible={ false }
					>
						{ __( 'The timestamp cannot be an empty value!', 'godam' ) }
					</Notice>
				}
			</div>

			<div className="flex flex-col godam-form-group">
				<p className="mb-4 label-text">{ __( 'Call to Action', 'godam' ) }</p>
				<SelectControl
					__next40pxDefaultSize
					label={ __( 'Select type', 'godam' ) }
					className="mb-4 godam-select"
					options={ [
						{
							label: 'Text',
							value: 'text',
						},
						{
							label: 'HTML',
							value: 'html',
						},
						{
							label: 'Image',
							value: 'image',
						},
					] }
					value={ layer.cta_type }
					onChange={ handleCTATypeSelect }
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
