/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Button, CheckboxControl, CustomSelectControl, Modal, SelectControl } from '@wordpress/components';
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

const CTATypes = [
	{
		value: 'text',
		label: 'Text',
	},
	{
		value: 'html',
		label: 'HTML',
	},
];

const CTALayer = ( { layerID, goBack } ) => {
	const [ isOpen, setOpen ] = useState( false );
	const [ formHTML, setFormHTML ] = useState( '' );
	const dispatch = useDispatch();
	const layer = useSelector( ( state ) =>
		state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ),
	);
	const handleDeleteLayer = () => {
		dispatch( removeLayer( { id: layer.id } ) );
		goBack();
	};

	console.log( 'Layer:', layer );

	const handleCTATypeSelect = ( e ) => {
		dispatch(
			updateLayerField( {
				id: layer.id,
				field: 'cta_type',
				value: e.selectedItem.key,
				type: e.selectedItem.key,
				name: e.selectedItem.name,
			} ),
		);
	};

	const renderSelectedCTAInputs = () => {
		switch ( layer?.cta_type ) {
			case 'text': return <TextCTA layerID={ layer.id } />;
			case 'image': return <ImageCTA layerID={ layer.id } />;
			case 'html': return <HtmlCTA layerID={ layer.id } />;
			default: <TextCTA layerID={ layer.id } />;
		}
	};

	useEffect( () => {
		if ( 'text' === layer?.cta_type ) {
			const html = `<a href="${ layer.link }" target="_blank">${ layer.text }</a>`;
			setFormHTML( html );
		} else if ( 'html' === layer?.cta_type ) {
			setFormHTML( layer.html );
		} else {
			setFormHTML( '' );
		}
	}, [ layer ] );

	return (
		<>
			<div className="flex justify-between items-center pb-3 border-b mb-3">
				<Button icon={ arrowLeft } onClick={ goBack } />
				<p className="font-semibold">
					{ __( 'Form layer at', 'transcoder' ) } { 5 }s
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
			<div className="flex gap-2 flex-col">
				<p>Call to Action</p>
				<CustomSelectControl
					__next40pxDefaultSize
					onChange={ handleCTATypeSelect }
					options={ [
						{
							key: 'text',
							name: 'Text',
						},
						{
							key: 'html',
							name: 'HTML',
						},
						{
							key: 'image',
							name: 'Image',
						},
					] }
					value={ layer.cta_type }
				/>
				{ renderSelectedCTAInputs() }

				{ /* Common settings */ }
				<CheckboxControl
					__nextHasNoMarginBottom
					label="Allow to Skip"
					checked={ layer.allow_skip }
					onChange={ ( value ) =>
						dispatch( updateLayerField( { id: layer.id, field: 'allow_skip', value } ) )
					}
				/>
			</div>
			<LayerControls>
				<>
					<div className="absolute inset-0 overflow-auto px-4 py-8 bg-white bg-opacity-70 my-auto">
						<div className="h-full flex items-center">
							<div
								className="max-w-[400px] mx-auto text-black text-5xl"
								dangerouslySetInnerHTML={ { __html: formHTML } }
							/>
						</div>
					</div>
					{
						layer.allow_skip &&
						<Button
							className="absolute bottom-6 right-0"
							variant="primary"
							icon={ chevronRight }
							iconSize="18"
							iconPosition="right"
						>
							{ __( 'Skip', 'transcoder' ) }
						</Button>
					}
				</>
			</LayerControls>
		</>
	);
};

export default CTALayer;
