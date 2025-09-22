/**
 * WordPress dependencies
 */
import { __, _x, sprintf } from '@wordpress/i18n';
import {
	NavigableMenu,
	MenuItem,
	FormFileUpload,
	MenuGroup,
	Button,
	TextControl,
	SelectControl,
	Modal,
} from '@wordpress/components';
import {
	MediaUpload,
	MediaUploadCheck,
	store as blockEditorStore,
} from '@wordpress/block-editor';
import { upload, media } from '@wordpress/icons';
import { useSelect } from '@wordpress/data';
import { useState } from '@wordpress/element';
import { getFilename } from '@wordpress/url';

const ALLOWED_TYPES = [ 'text/vtt' ];
const DEFAULT_KIND = 'subtitles';

const KIND_OPTIONS = [
	{ label: __( 'Subtitles', 'godam' ), value: 'subtitles' },
	{ label: __( 'Captions', 'godam' ), value: 'captions' },
	{ label: __( 'Descriptions', 'godam' ), value: 'descriptions' },
	{ label: __( 'Chapters', 'godam' ), value: 'chapters' },
	{ label: __( 'Metadata', 'godam' ), value: 'metadata' },
];

function TrackList( { tracks, onEditPress } ) {
	return (
		<MenuGroup
			label={ __( 'Video Captions', 'godam' ) }
			className="block-library-video-tracks-editor__track-list"
		>
			{ tracks.map( ( track, index ) => (
				<div
					key={ index }
					className="block-library-video-tracks-editor__track-list-track"
				>
					<span>{ track.label }</span>
					<Button
						variant="tertiary"
						onClick={ () => onEditPress( index ) }
						aria-label={ sprintf(
							// translators: %s: video caption label.
							_x( 'Edit %s', 'video caption', 'godam' ),
							track.label,
						) }
					>
						{ __( 'Edit', 'godam' ) }
					</Button>
				</div>
			) ) }
		</MenuGroup>
	);
}

function SingleTrackEditor( { track, onChange, onClose, onRemove } ) {
	const { src = '', label = '', srcLang = '', kind = DEFAULT_KIND } = track;
	const fileName = src.startsWith( 'blob:' ) ? '' : getFilename( src ) || '';

	return (
		<div className="block-library-video-tracks-editor__single-track-editor">
			<h3>{ __( 'Edit track', 'godam' ) }</h3>
			<p>
				{ __( 'File', 'godam' ) }: <b>{ fileName }</b>
			</p>

			<TextControl
				label={ __( 'Label', 'godam' ) }
				value={ label }
				onChange={ ( newLabel ) => onChange( { ...track, label: newLabel } ) }
				help={ __( 'Title of track', 'godam' ) }
			/>

			<TextControl
				label={ __( 'Source language', 'godam' ) }
				value={ srcLang }
				onChange={ ( newLang ) => onChange( { ...track, srcLang: newLang } ) }
				help={ __( 'Language tag (en, fr, etc.)', 'godam' ) }
			/>

			<SelectControl
				label={ __( 'Kind', 'godam' ) }
				value={ kind }
				options={ KIND_OPTIONS }
				onChange={ ( newKind ) => onChange( { ...track, kind: newKind } ) }
			/>

			<div style={ { marginTop: '16px' } }>
				<Button
					isDestructive
					variant="link"
					onClick={ onRemove }
					style={ { marginRight: '12px' } }
				>
					{ __( 'Remove track', 'godam' ) }
				</Button>
				<Button
					variant="primary"
					onClick={ () => {
						const changes = {};
						if ( ! label ) {
							changes.label = __( 'English', 'godam' );
						}
						if ( ! srcLang ) {
							changes.srcLang = 'en';
						}
						if ( ! kind ) {
							changes.kind = DEFAULT_KIND;
						}
						onChange( { ...track, ...changes } );
						onClose();
					} }
				>
					{ __( 'Apply', 'godam' ) }
				</Button>
			</div>
		</div>
	);
}

export default function TracksEditor( { tracks = [], onChange } ) {
	const mediaUpload = useSelect( ( select ) => {
		return select( blockEditorStore ).getSettings().mediaUpload;
	}, [] );

	const [ isModalOpen, setIsModalOpen ] = useState( false );
	const [ trackBeingEdited, setTrackBeingEdited ] = useState( null );

	if ( ! mediaUpload ) {
		return null;
	}

	return (
		<>
			<Button
				variant="primary"
				style={ { height: 40 } }
				onClick={ () => setIsModalOpen( true ) }
			>
				{ __( 'Add Video Caption', 'godam' ) }
			</Button>

			{ isModalOpen && (
				<Modal
					title={ __( 'Manage Video Captions', 'godam' ) }
					onRequestClose={ () => {
						setTrackBeingEdited( null );
						setIsModalOpen( false );
					} }
					className="block-library-video-tracks-editor__modal"
				>
					{ trackBeingEdited !== null ? (
						<SingleTrackEditor
							track={ tracks[ trackBeingEdited ] }
							onChange={ ( newTrack ) => {
								const newTracks = [ ...tracks ];
								newTracks[ trackBeingEdited ] = newTrack;
								onChange( newTracks );
							} }
							onClose={ () => setTrackBeingEdited( null ) }
							onRemove={ () => {
								onChange( tracks.filter( ( _, i ) => i !== trackBeingEdited ) );
								setTrackBeingEdited( null );
							} }
						/>
					) : (
						<>
							{ tracks.length === 0 && (
								<div className="block-library-video-tracks-editor__empty">
									<h2>{ __( 'No captions added yet', 'godam' ) }</h2>
									<p>
										{ __(
											'You can upload subtitle or caption files (.vtt) to improve accessibility.',
											'godam',
										) }
									</p>
								</div>
							) }

							<NavigableMenu>
								<TrackList tracks={ tracks } onEditPress={ setTrackBeingEdited } />

								<MenuGroup
									className="block-library-video-tracks-editor__add-tracks-container"
									label={ __( 'Add new track', 'godam' ) }
								>
									<MediaUpload
										onSelect={ ( { url } ) => {
											const trackIndex = tracks.length;
											onChange( [ ...tracks, { src: url, kind: DEFAULT_KIND } ] );
											setTrackBeingEdited( trackIndex );
										} }
										allowedTypes={ ALLOWED_TYPES }
										render={ ( { open } ) => (
											<MenuItem icon={ media } onClick={ open }>
												{ __( 'Open Media Library', 'godam' ) }
											</MenuItem>
										) }
									/>
									<MediaUploadCheck>
										<FormFileUpload
											accept=".vtt,text/vtt"
											onChange={ ( event ) => {
												const files = event.target.files;
												const trackIndex = tracks.length;
												mediaUpload( {
													allowedTypes: ALLOWED_TYPES,
													filesList: files,
													onFileChange: ( [ { url } ] ) => {
														const newTracks = [ ...tracks ];
														newTracks[ trackIndex ] = { src: url, kind: DEFAULT_KIND };
														onChange( newTracks );
														setTrackBeingEdited( trackIndex );
													},
												} );
											} }
											render={ ( { openFileDialog } ) => (
												<MenuItem icon={ upload } onClick={ openFileDialog }>
													{ _x( 'Upload', 'verb', 'godam' ) }
												</MenuItem>
											) }
										/>
									</MediaUploadCheck>
								</MenuGroup>
							</NavigableMenu>
						</>
					) }
				</Modal>
			) }
		</>
	);
}
