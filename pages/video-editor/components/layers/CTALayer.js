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
		fetch( `/wp-json/wp/v2/media/${ mediaId }` )
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
	<TextCTA layerID={ layer.id } />;
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
			<div className="flex justify-between items-center pb-3 border-b mb-3">
				<Button icon={ arrowLeft } onClick={ goBack } />
				<p className="font-semibold">
					{ __( 'Form layer at', 'transcoder' ) } { layer.displayTime }s
				</p>
				<Button icon={ trash } isDestructive onClick={ () => setOpen( true ) } />
				{ isOpen && (
					<Modal
						title={ __( 'Delete layer', 'transcoder' ) }
						onRequestClose={ () => setOpen( false ) }
					>
						<div className="flex justify-between items-center gap-3">
							<Button
								className="w-full justify-center"
								isDestructive
								variant="primary"
								onClick={ handleDeleteLayer }
							>
								{ __( 'Delete layer', 'transcoder' ) }
							</Button>
							<Button
								className="w-full justify-center"
								variant="secondary"
								onClick={ () => setOpen( false ) }
							>
								{ __( 'Cancel', 'transcoder' ) }
							</Button>
						</div>
					</Modal>
				) }
			</div>
			<div className="flex flex-col">
				<p className="mb-4">{ __( 'Call to Action', 'transcoder' ) }</p>
				<SelectControl
					__next40pxDefaultSize
					label={ __( 'Select type', 'transcoder' ) }
					className="mb-4"
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
				<ToggleControl
					label={ __( 'Allow user to skip', 'transcoder' ) }
					checked={ layer.allow_skip }
					onChange={ ( value ) =>
						dispatch(
							updateLayerField( { id: layer.id, field: 'allow_skip', value } ),
						)
					}
					help={ __(
						'If enabled, the user will be able to skip the form submission.',
						'transcoder',
					) }
					className="mb-4"
				/>

				<Panel className="-mx-4 border-x-0">
					<PanelBody
						title={ __( 'Advance', 'transcoder' ) }
						initialOpen={ false }
					>
						{ /* Layer background color */ }
						<label htmlFor="color" className="easydam-label">{ __( 'Color', 'transcoder' ) }</label>
						<ColorPickerButton
							className="mb-4"
							value={ layer?.bg_color ?? '#FFFFFFB3' }
							label={ __( 'Layer background color', 'transcoder' ) }
							enableAlpha={ true }
							onChange={ ( value ) => dispatch( updateLayerField( { id: layer.id, field: 'bg_color', value } ) ) }
						/>
					</PanelBody>
				</Panel>

			</div>
			<LayerControls>
				<>
					<div className="absolute inset-0 overflow-auto px-4 py-8 bg-white bg-opacity-70 my-auto">
						<div className="h-full flex items-center">
							<div
								className={ `${ 'image' === layer?.cta_type ? 'm-auto' : 'max-w-[400px]' } mx-auto text-black text-5xl` }
								dangerouslySetInnerHTML={ { __html: formHTML } }
							/>
						</div>
					</div>
					{ layer.allow_skip && (
						<Button
							className="absolute bottom-6 right-0"
							variant="primary"
							icon={ chevronRight }
							iconSize="18"
							iconPosition="right"
						>
							{ __( 'Skip', 'transcoder' ) }
						</Button>
					) }
				</>
			</LayerControls>
		</>
	);
};

export default CTALayer;
