/**
 * WordPress dependencies
 */
import { __, _x, sprintf } from '@wordpress/i18n';
import {
	NavigableMenu,
	MenuItem,
	FormFileUpload,
	MenuGroup,
	ToolbarGroup,
	ToolbarButton,
	Dropdown,
	Button,
	TextControl,
	SelectControl,
} from '@wordpress/components';
import {
	MediaUpload,
	MediaUploadCheck,
	store as blockEditorStore,
} from '@wordpress/block-editor';
import { upload, media } from '@wordpress/icons';
import { useSelect } from '@wordpress/data';
import { useState, useRef, useEffect } from '@wordpress/element';
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
	const content = tracks.map( ( track, index ) => {
		return (
			<div
				key={ index }
				className="block-library-video-tracks-editor__track-list-track"
			>
				<span>{ track.label }</span>
				<Button
					__next40pxDefaultSize
					variant="tertiary"
					onClick={ () => onEditPress( index ) }
					aria-label={ sprintf(
						/* translators: %s: Label of the video text track e.g: "French subtitles". */
						_x( 'Edit %s', 'text tracks', 'godam' ),
						track.label,
					) }
				>
					{ __( 'Edit', 'godam' ) }
				</Button>
			</div>
		);
	} );

	return (
		<MenuGroup
			label={ __( 'Text tracks', 'godam' ) }
			className="block-library-video-tracks-editor__track-list"
		>
			{ content }
		</MenuGroup>
	);
}

function SingleTrackEditor( { track, onChange, onClose, onRemove } ) {
	const { src = '', label = '', srcLang = '', kind = DEFAULT_KIND } = track;
	const fileName = src.startsWith( 'blob:' ) ? '' : getFilename( src ) || '';
	return (
		<div
			className="block-library-video-tracks-editor__single-track-editor"
			spacing="4"
		>
			<span className="block-library-video-tracks-editor__single-track-editor-edit-track-label">
				{ __( 'Edit track', 'godam' ) }
			</span>
			<span>
				{ __( 'File', 'godam' ) }: <b>{ fileName }</b>
			</span>
			<div columns={ 2 } gap={ 4 }>
				<TextControl
					__next40pxDefaultSize
					__nextHasNoMarginBottom
					onChange={ ( newLabel ) =>
						onChange( {
							...track,
							label: newLabel,
						} )
					}
					label={ __( 'Label', 'godam' ) }
					value={ label }
					help={ __( 'Title of track', 'godam' ) }
				/>
				<TextControl
					__next40pxDefaultSize
					__nextHasNoMarginBottom
					onChange={ ( newSrcLang ) =>
						onChange( {
							...track,
							srcLang: newSrcLang,
						} )
					}
					label={ __( 'Source language', 'godam' ) }
					value={ srcLang }
					help={ __( 'Language tag (en, fr, etc.)', 'godam' ) }
				/>
			</div>
			<div spacing="8">
				<SelectControl
					__next40pxDefaultSize
					__nextHasNoMarginBottom
					className="block-library-video-tracks-editor__single-track-editor-kind-select"
					options={ KIND_OPTIONS }
					value={ kind }
					label={ __( 'Kind', 'godam' ) }
					onChange={ ( newKind ) => {
						onChange( {
							...track,
							kind: newKind,
						} );
					} }
				/>
				<div className="block-library-video-tracks-editor__single-track-editor-buttons-container">
					<Button
						__next40pxDefaultSize
						isDestructive
						variant="link"
						onClick={ onRemove }
					>
						{ __( 'Remove track', 'godam' ) }
					</Button>
					<Button
						__next40pxDefaultSize
						variant="primary"
						onClick={ () => {
							const changes = {};
							let hasChanges = false;
							if ( label === '' ) {
								changes.label = __( 'English', 'godam' );
								hasChanges = true;
							}
							if ( srcLang === '' ) {
								changes.srcLang = 'en';
								hasChanges = true;
							}
							if ( track.kind === undefined ) {
								changes.kind = DEFAULT_KIND;
								hasChanges = true;
							}
							if ( hasChanges ) {
								onChange( {
									...track,
									...changes,
								} );
							}
							onClose();
						} }
					>
						{ __( 'Apply', 'godam' ) }
					</Button>
				</div>
			</div>
		</div>
	);
}

export default function TracksEditor( { tracks = [], onChange } ) {
	const mediaUpload = useSelect( ( select ) => {
		return select( blockEditorStore ).getSettings().mediaUpload;
	}, [] );
	const [ trackBeingEdited, setTrackBeingEdited ] = useState( null );
	const dropdownPopoverRef = useRef();

	useEffect( () => {
		dropdownPopoverRef.current?.focus();
	}, [ trackBeingEdited ] );

	if ( ! mediaUpload ) {
		return null;
	}
	return (
		<Dropdown
			contentClassName="block-library-video-tracks-editor"
			focusOnMount
			popoverProps={ {
				ref: dropdownPopoverRef,
			} }
			renderToggle={ ( { isOpen, onToggle } ) => {
				const handleOnToggle = () => {
					if ( ! isOpen ) {
						// When the Popover opens make sure the initial view is
						// always the track list rather than the edit track UI.
						setTrackBeingEdited( null );
					}
					onToggle();
				};

				return (
					<ToolbarGroup>
						<ToolbarButton
							aria-expanded={ isOpen }
							aria-haspopup="true"
							onClick={ handleOnToggle }
						>
							{ __( 'Text tracks', 'godam' ) }
						</ToolbarButton>
					</ToolbarGroup>
				);
			} }
			renderContent={ () => {
				if ( trackBeingEdited !== null ) {
					return (
						<SingleTrackEditor
							track={ tracks[ trackBeingEdited ] }
							onChange={ ( newTrack ) => {
								const newTracks = [ ...tracks ];
								newTracks[ trackBeingEdited ] = newTrack;
								onChange( newTracks );
							} }
							onClose={ () => setTrackBeingEdited( null ) }
							onRemove={ () => {
								onChange(
									tracks.filter( ( _track, index ) => index !== trackBeingEdited ),
								);
								setTrackBeingEdited( null );
							} }
						/>
					);
				}

				return (
					<>
						{ tracks.length === 0 && (
							<div className="block-library-video-tracks-editor__tracks-informative-message">
								<h2 className="block-library-video-tracks-editor__tracks-informative-message-title">
									{ __( 'Text tracks', 'godam' ) }
								</h2>
								<p className="block-library-video-tracks-editor__tracks-informative-message-description">
									{ __(
										'Tracks can be subtitles, captions, chapters, or descriptions. They help make your content more accessible to a wider range of users.',
										'godam',
									) }
								</p>
							</div>
						) }
						<NavigableMenu>
							<TrackList tracks={ tracks } onEditPress={ setTrackBeingEdited } />
							<MenuGroup
								className="block-library-video-tracks-editor__add-tracks-container"
								label={ __( 'Add tracks', 'godam' ) }
							>
								<MediaUpload
									onSelect={ ( { url } ) => {
										const trackIndex = tracks.length;
										onChange( [ ...tracks, { src: url } ] );
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
										onChange={ ( event ) => {
											const files = event.target.files;
											const trackIndex = tracks.length;
											mediaUpload( {
												allowedTypes: ALLOWED_TYPES,
												filesList: files,
												onFileChange: ( [ { url } ] ) => {
													const newTracks = [ ...tracks ];
													if ( ! newTracks[ trackIndex ] ) {
														newTracks[ trackIndex ] = {};
													}
													newTracks[ trackIndex ] = {
														...tracks[ trackIndex ],
														src: url,
													};
													onChange( newTracks );
													setTrackBeingEdited( trackIndex );
												},
											} );
										} }
										accept=".vtt,text/vtt"
										render={ ( { openFileDialog } ) => {
											return (
												<MenuItem
													icon={ upload }
													onClick={ () => {
														openFileDialog();
													} }
												>
													{ _x( 'Upload', 'verb', 'godam' ) }
												</MenuItem>
											);
										} }
									/>
								</MediaUploadCheck>
							</MenuGroup>
						</NavigableMenu>
					</>
				);
			} }
		/>
	);
}
