/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import {
	Button,
	Modal,
	SelectControl,
	ToggleControl,
	ColorPalette,
	Panel,
	PanelBody,
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
import ColorPickerButton from '../ColorPickerButton';

const CTALayer = ( { layerID, goBack } ) => {
	const [ isOpen, setOpen ] = useState( false );
	const [ formHTML, setFormHTML ] = useState( '' );
	const [ imageCtaUrl, setImageCtaUrl ] = useState( '' );
	const dispatch = useDispatch();

	const restURL = window.godamRestRoute.url || '';

	const layer = useSelector( ( state ) =>
		state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ),
	);
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
						<button class="image-cta-btn">
							<a href="${ layer?.imageLink || '/' }" target="_blank">
								${ layer?.imageCtaButtonText || 'Buy Now' }
							</a>
						</button>
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
			<div className="flex justify-between items-center border-b mb-3">
				<Button icon={ arrowLeft } onClick={ goBack } />
				<p className="text-base">{ __( 'CTA layer at', 'godam' ) } { layer.displayTime }s</p>
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

			<div className="flex flex-col">
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

				<Panel
					className="-mx-4 border-x-0 godam-advance-panel"
				>
					<PanelBody
						title={ __( 'Advance', 'godam' ) }
						initialOpen={ false }
					>
						{ /* Layer background color */ }
						<label htmlFor="color" className="godam-label mb-2">{ __( 'Color', 'godam' ) }</label>
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
						<div className="easydam-layer" dangerouslySetInnerHTML={ { __html: formHTML } } style={ { backgroundColor: layer.bg_color } } />
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
