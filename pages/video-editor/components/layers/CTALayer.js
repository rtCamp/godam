/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Button, CustomSelectControl, Modal } from '@wordpress/components';
import { arrowLeft, chevronRight, trash } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';
import { useState, useEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { removeLayer, updateCtaLayer } from '../../redux/slice/videoSlice';
import TextCTA from '../cta/TextCTA';
import ImageCTA from '../cta/ImageCTA';
import HtmlCTA from '../cta/HtmlCTA';
import LayerControls from '../LayerControls';

const CTALayer = ( { layerID, goBack } ) => {
	const [ isOpen, setOpen ] = useState( false );
	const cta = useSelector( ( state ) => state.videoReducer.cta );
	const [ formHTML, setFormHTML ] = useState( '' );
	const dispatch = useDispatch();
	const layer = useSelector( ( state ) =>
		state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ),
	);
	const handleDeleteLayer = () => {
		dispatch( removeLayer( { id: layer.id } ) );
		goBack();
	};

	const handleCTATypeSelect = ( e ) => {
		dispatch(
			updateCtaLayer( {
				type: e.selectedItem.key,
				name: e.selectedItem.name,
			} ),
		);
	};

	const renderSelectedCTAInputs = () => {
		switch ( cta?.type ) {
			case 'text': return <TextCTA />;
			case 'image': return <ImageCTA />;
			case 'html': return <HtmlCTA />;
			default: <TextCTA />;
		}
	};

	useEffect( () => {
		if ( 'text' === cta?.type ) {
			const html = `<a href="${ cta.link }">${ cta.text }</a>`;
			setFormHTML( html );
		} else if ( 'html' === cta?.type ) {
			setFormHTML( cta.html );
		} else {
			setFormHTML( '' );
		}
	}, [ cta ] );

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
					value={ {
						key: cta.type,
						name: cta.name,
					} }
				/>
				{ renderSelectedCTAInputs() }
			</div>
			<LayerControls>
				<>
					<div className="absolute inset-0 overflow-auto px-4 py-8 bg-white bg-opacity-70 my-auto">
						<div className="h-full flex items-center">
							<div
								className="max-w-[400px] mx-auto text-white text-5xl"
								dangerouslySetInnerHTML={ { __html: formHTML } }
							/>
						</div>
					</div>
					<Button
						className="absolute bottom-6 right-0"
						variant="primary"
						icon={ chevronRight }
						iconSize="18"
						iconPosition="right"
						// onClick={ () => showForm( false ) }
					>
						{ __( 'Skip', 'transcoder' ) }
					</Button>
				</>
			</LayerControls>
		</>
	);
};

export default CTALayer;
