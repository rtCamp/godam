/**
 * External dependencies
 */
import React, { useRef, useState } from 'react';

/**
 * WordPress dependencies
 */
import {
	Button,
	Modal,
	Spinner,
	Notice,
	SelectControl,
	TextControl,
	CheckboxControl,
	Flex,
	FlexItem,
} from '@wordpress/components';
import { __, _n, sprintf } from '@wordpress/i18n';
import { plus, trash, edit, download } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import {
	useListCaptionsQuery,
	useUploadCaptionMutation,
	useUpdateCaptionMutation,
	useDeleteCaptionMutation,
	useSetDefaultCaptionMutation,
} from '../../redux/api/transcription';
import { CAPTION_LANGUAGES, languageLabel } from './languages';
import { getPricingUrl } from '../../../shared/premium-layers';
import CaptionCueEditor from './CaptionCueEditor';

const FREE_TEXT = '__other__';

// Same marks as GoDAM Central's caption dialog: an outlined check for "make this the default",
// a filled green one on the track that already is, and circular arrows for "replace".
// Stroke-only icons: the --stroke class stops the button's fill rule from filling them.
const DefaultIcon = (
	<svg className="godam-ve-caption-manager__icon--stroke" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
		<circle cx="12" cy="12" r="8" />
		<path d="M8.75 12.25l2.25 2.25 4.25-4.5" />
	</svg>
);
const IsDefaultIcon = (
	<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
		<circle cx="12" cy="12" r="8.75" fill="#3d9a50" />
		<path d="M8.75 12.25l2.25 2.25 4.25-4.5" fill="none" stroke="#fff" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
);
const ReplaceIcon = (
	<svg className="godam-ve-caption-manager__icon--stroke" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
		<path d="M19 11a7 7 0 0 0-12.4-4.2L5 8.5" />
		<path d="M5 4.5v4h4" />
		<path d="M5 13a7 7 0 0 0 12.4 4.2L19 15.5" />
		<path d="M19 19.5v-4h-4" />
	</svg>
);

/**
 * Read a picked caption File into text + detected source format.
 *
 * @param {File} file The chosen .vtt / .srt file.
 * @return {Promise<{name:string,content:string,sourceFormat:string}>} File name, text and format.
 */
const readCaptionFile = ( file ) =>
	new Promise( ( resolve, reject ) => {
		const reader = new FileReader();
		reader.onload = () => {
			const ext = ( file.name.split( '.' ).pop() || '' ).toLowerCase();
			resolve( {
				name: file.name,
				content: String( reader.result || '' ),
				sourceFormat: ext === 'srt' ? 'srt' : 'vtt',
			} );
		};
		reader.onerror = () => reject( reader.error );
		reader.readAsText( file );
	} );

/**
 * Caption manager dialog.
 *
 * Owns add / replace / edit / set-default / delete for a media item's caption
 * tracks (SaaS `api/captions.py`). Validation lives on the server; this surfaces
 * the one-at-a-time reason it returns.
 *
 * @param {Object}   props              Props.
 * @param {number}   props.attachmentID WordPress attachment id.
 * @param {Function} props.onClose      Close handler.
 * @return {JSX.Element} The caption manager modal.
 */
const CaptionManager = ( { attachmentID, onClose } ) => {
	const { data, isLoading, isFetching, isError, error: listError } = useListCaptionsQuery( attachmentID );
	const [ uploadCaption, { isLoading: isUploading } ] = useUploadCaptionMutation();
	const [ updateCaption ] = useUpdateCaptionMutation();
	const [ deleteCaption ] = useDeleteCaptionMutation();
	const [ setDefaultCaption ] = useSetDefaultCaptionMutation();

	const [ error, setError ] = useState( '' );
	const [ showAdd, setShowAdd ] = useState( false );
	const [ editing, setEditing ] = useState( null );
	const [ busyId, setBusyId ] = useState( '' );

	// Add-form state.
	const [ form, setForm ] = useState( { language: 'en', freeLang: '', label: '', isDefault: false } );
	const [ pendingFile, setPendingFile ] = useState( null );

	const addFileRef = useRef( null );
	const replaceFileRef = useRef( null );
	const replaceTargetRef = useRef( null );

	// Central's caption endpoints return `{ success, captions: [...] }`.
	// A to Z by the name shown, so a row does not jump when it becomes the default.
	const captions = ( Array.isArray( data?.captions ) ? [ ...data.captions ] : [] ).sort( ( a, b ) =>
		( a.label || languageLabel( a.language ) ).localeCompare( b.label || languageLabel( b.language ), undefined, { sensitivity: 'base' } ),
	);

	const resolvedLanguage = form.language === FREE_TEXT ? form.freeLang.trim() : form.language;

	// No GoDAM account, or a free one: explain and offer the upgrade instead of an error.
	const listErrorCode = listError?.data?.code || '';
	const needsPlan = [ 'rtgodam_no_api_key', 'rtgodam_no_subscription' ].includes( listErrorCode );

	// The label is the track's name in the player's menu, so the user picks it and
	// no two tracks on a video may share one (ignoring case and outer spaces).
	const newLabel = form.label.trim();
	const labelTaken = '' !== newLabel && captions.some(
		( caption ) => ( caption.label || languageLabel( caption.language ) ).trim().toLowerCase() === newLabel.toLowerCase(),
	);
	const labelError = labelTaken
		? sprintf(
			/* translators: %s: caption label the user typed. */
			__( 'A caption named "%s" already exists on this video. Choose another label.', 'godam' ),
			newLabel,
		)
		: '';

	/* ---- Add ---- */

	const onAddFilePicked = async ( event ) => {
		const file = event.target.files?.[ 0 ];
		event.target.value = ''; // allow re-picking the same file
		if ( ! file ) {
			return;
		}
		if ( ! /\.(vtt|srt)$/i.test( file.name ) ) {
			setError( __( 'Please choose a .vtt or .srt caption file.', 'godam' ) );
			return;
		}
		try {
			setPendingFile( await readCaptionFile( file ) );
			setError( '' );
		} catch ( err ) {
			setError( __( 'Could not read the caption file.', 'godam' ) );
		}
	};

	const handleAdd = async () => {
		setError( '' );
		if ( ! pendingFile ) {
			setError( __( 'Choose a caption file first.', 'godam' ) );
			return;
		}
		if ( ! resolvedLanguage ) {
			setError( __( 'Choose a language for this caption.', 'godam' ) );
			return;
		}
		if ( ! newLabel ) {
			setError( __( 'Enter a label for this caption. It is the name shown in the subtitles menu.', 'godam' ) );
			return;
		}
		if ( labelTaken ) {
			return;
		}
		try {
			await uploadCaption( {
				attachmentID,
				content: pendingFile.content,
				sourceFormat: pendingFile.sourceFormat,
				language: resolvedLanguage,
				label: newLabel,
				kind: 'subtitles',
				isDefault: form.isDefault,
			} ).unwrap();
			// Reset the form.
			setShowAdd( false );
			setPendingFile( null );
			setForm( { language: 'en', freeLang: '', label: '', isDefault: false } );
		} catch ( err ) {
			setError( err?.data?.message || __( 'Could not add the caption track.', 'godam' ) );
		}
	};

	/* ---- Row actions ---- */

	const onReplaceFilePicked = async ( event ) => {
		const file = event.target.files?.[ 0 ];
		const captionID = replaceTargetRef.current;
		event.target.value = '';
		replaceTargetRef.current = null;
		if ( ! file || ! captionID ) {
			return;
		}
		if ( ! /\.(vtt|srt)$/i.test( file.name ) ) {
			setError( __( 'Please choose a .vtt or .srt caption file.', 'godam' ) );
			return;
		}
		setError( '' );
		setBusyId( captionID );
		try {
			const { content } = await readCaptionFile( file );
			await updateCaption( { attachmentID, captionID, content } ).unwrap();
		} catch ( err ) {
			setError( err?.data?.message || __( 'Could not replace the caption file.', 'godam' ) );
		} finally {
			setBusyId( '' );
		}
	};

	const triggerReplace = ( captionID ) => {
		replaceTargetRef.current = captionID;
		replaceFileRef.current?.click();
	};

	const handleSetDefault = async ( captionID ) => {
		setError( '' );
		setBusyId( captionID );
		try {
			await setDefaultCaption( { attachmentID, captionID } ).unwrap();
		} catch ( err ) {
			setError( err?.data?.message || __( 'Could not set the default caption.', 'godam' ) );
		} finally {
			setBusyId( '' );
		}
	};

	const handleDelete = async ( captionID ) => {
		setError( '' );
		setBusyId( captionID );
		try {
			await deleteCaption( { attachmentID, captionID } ).unwrap();
		} catch ( err ) {
			setError( err?.data?.message || __( 'Could not delete the caption track.', 'godam' ) );
		} finally {
			setBusyId( '' );
		}
	};

	const languageOptions = [
		...CAPTION_LANGUAGES.map( ( { value, label } ) => ( { value, label } ) ),
		{ value: FREE_TEXT, label: __( 'Other (enter code)…', 'godam' ) },
	];

	return (
		<Modal
			title={ __( 'Manage caption tracks', 'godam' ) }
			onRequestClose={ onClose }
			className="godam-ve-caption-manager"
		>
			{ error && (
				<Notice status="error" isDismissible onRemove={ () => setError( '' ) }>
					{ error }
				</Notice>
			) }

			{ isError && needsPlan && (
				<div className="godam-ve-caption-manager__plan" data-test-id="godam-caption-plan-notice">
					<p className="godam-ve-caption-manager__plan-title">
						{ __( 'Captions in more than one language are part of the paid GoDAM plans', 'godam' ) }
					</p>
					<p>
						{ __( 'With a paid plan, every language you add or generate here appears in the player\'s subtitles menu. On your current plan, Upload File in the Transcription tab still adds one caption file to this video.', 'godam' ) }
					</p>
					<div className="godam-ve-caption-manager__plan-actions">
						<Button variant="primary" href={ getPricingUrl( 'caption-tracks' ) } target="_blank" rel="noreferrer">
							{ __( 'See plans', 'godam' ) }
						</Button>
						{ 'rtgodam_no_api_key' === listErrorCode && (
							<Button variant="secondary" href={ `${ window?.videoData?.adminUrl || '/wp-admin/' }admin.php?page=rtgodam_settings` }>
								{ __( 'Connect your account', 'godam' ) }
							</Button>
						) }
					</div>
				</div>
			) }

			{ isError && ! needsPlan && (
				<Notice status="error" isDismissible={ false }>
					{ listError?.data?.message || __( 'Could not load the caption tracks.', 'godam' ) }
				</Notice>
			) }

			{ isLoading ? (
				<div className="godam-ve-transcription__loader">
					<Spinner />
				</div>
			) : (
				<ul className="godam-ve-caption-manager__list">
					{ captions.map( ( caption ) => {
						const id = caption.caption_id;
						const isUploaded = caption.source === 'Uploaded';
						// Rebuilding the VTT drops styling, so only plain tracks get the cue editor.
						const canEditCues = ! caption.has_rich_formatting;
						const rowBusy = busyId === id;
						return (
							<li key={ id } className="godam-ve-caption-manager__row" data-test-id={ `godam-caption-row-${ id }` }>
								<div className="godam-ve-caption-manager__meta">
									<span className="godam-ve-caption-manager__title">
										<span className="godam-ve-caption-manager__label">
											{ caption.label || languageLabel( caption.language ) }
										</span>
										{ caption.is_default && (
											<span className="godam-ve-caption-manager__badge is-default">
												{ __( 'Default', 'godam' ) }
											</span>
										) }
										<span className="godam-ve-caption-manager__badge">
											{ isUploaded ? __( 'Uploaded', 'godam' ) : __( 'Generated', 'godam' ) }
										</span>
									</span>
									<span className="godam-ve-caption-manager__sub">
										{ [
											caption.language,
											caption.cue_count
												? sprintf(
													/* translators: %d: number of cues in the caption file. */
													_n( '%d cue', '%d cues', caption.cue_count, 'godam' ),
													caption.cue_count,
												)
												: '',
											// A generated track with no file is still running or failed.
											! caption.vtt_path && caption.status ? caption.status : '',
										]
											.filter( Boolean )
											.join( ' • ' ) }
									</span>
								</div>
								<div className="godam-ve-caption-manager__actions">
									{ rowBusy && <Spinner /> }
									<Button
										icon={ edit }
										label={ __( 'Edit captions', 'godam' ) }
										showTooltip
										disabled={ ! canEditCues || rowBusy || ! caption.vtt_path }
										onClick={ () => setEditing( caption ) }
									/>
									<Button
										icon={ ReplaceIcon }
										label={ __( 'Replace file', 'godam' ) }
										showTooltip
										disabled={ rowBusy }
										onClick={ () => triggerReplace( id ) }
									/>
									{ caption.vtt_path && (
										<Button
											icon={ download }
											label={ __( 'Download', 'godam' ) }
											showTooltip
											href={ caption.vtt_path }
											target="_blank"
											rel="noreferrer"
											download
										/>
									) }
									<Button
										icon={ caption.is_default ? IsDefaultIcon : DefaultIcon }
										label={ caption.is_default ? __( 'Shown by default', 'godam' ) : __( 'Show this caption by default', 'godam' ) }
										showTooltip
										className="godam-ve-caption-manager__default-btn"
										disabled={ caption.is_default || rowBusy || ! caption.vtt_path }
										onClick={ () => handleSetDefault( id ) }
									/>
									<Button
										icon={ trash }
										label={ __( 'Delete', 'godam' ) }
										showTooltip
										isDestructive
										disabled={ rowBusy }
										onClick={ () => handleDelete( id ) }
									/>
								</div>
							</li>
						);
					} ) }
					{ captions.length === 0 && ! isFetching && ! isError && (
						<li className="godam-ve-caption-manager__empty">
							{ __( 'No caption tracks yet.', 'godam' ) }
						</li>
					) }
				</ul>
			) }

			{ /* Add form */ }
			{ ! isError && showAdd && (
				<div className="godam-ve-caption-manager__add">
					<Flex align="flex-end" gap={ 3 } wrap>
						<FlexItem>
							<SelectControl
								__nextHasNoMarginBottom
								label={ __( 'Language', 'godam' ) }
								value={ form.language }
								options={ languageOptions }
								onChange={ ( language ) => setForm( ( f ) => ( { ...f, language } ) ) }
							/>
						</FlexItem>
						{ form.language === FREE_TEXT && (
							<FlexItem>
								<TextControl
									__nextHasNoMarginBottom
									label={ __( 'Language code', 'godam' ) }
									placeholder="e.g. cy, pt-BR"
									value={ form.freeLang }
									onChange={ ( freeLang ) => setForm( ( f ) => ( { ...f, freeLang } ) ) }
								/>
							</FlexItem>
						) }
						<FlexItem>
							<TextControl
								__nextHasNoMarginBottom
								label={ __( 'Label', 'godam' ) }
								placeholder={ __( 'Shown in the menu', 'godam' ) }
								value={ form.label }
								required
								className={ labelError ? 'godam-ve-caption-manager__label-field has-error' : 'godam-ve-caption-manager__label-field' }
								help={ labelError }
								onChange={ ( label ) => setForm( ( f ) => ( { ...f, label } ) ) }
							/>
						</FlexItem>
					</Flex>
					<div className="godam-ve-caption-manager__add-row">
						<Button variant="secondary" onClick={ () => addFileRef.current?.click() }>
							{ pendingFile ? __( 'Choose another file', 'godam' ) : __( 'Choose file', 'godam' ) }
						</Button>
						{ pendingFile && (
							<span className="godam-ve-caption-manager__file-name" title={ pendingFile.name }>
								{ pendingFile.name }
							</span>
						) }
						<CheckboxControl
							__nextHasNoMarginBottom
							label={ __( 'Set as default', 'godam' ) }
							checked={ form.isDefault }
							onChange={ ( isDefault ) => setForm( ( f ) => ( { ...f, isDefault } ) ) }
						/>
					</div>
					<div className="flex justify-between items-center gap-3">
						<Button
							variant="tertiary"
							className="w-full justify-center"
							onClick={ () => {
								setShowAdd( false );
								setPendingFile( null );
							} }
						>
							{ __( 'Cancel', 'godam' ) }
						</Button>
						<Button
							variant="primary"
							className="w-full justify-center"
							isBusy={ isUploading }
							disabled={ isUploading || labelTaken }
							onClick={ handleAdd }
						>
							{ __( 'Add caption', 'godam' ) }
						</Button>
					</div>
				</div>
			) }
			{ ! isError && ! showAdd && (
				<Button
					variant="secondary"
					icon={ plus }
					className="godam-ve-caption-manager__add-btn"
					onClick={ () => setShowAdd( true ) }
				>
					{ __( 'Add caption track', 'godam' ) }
				</Button>
			) }

			{ /* Hidden file inputs */ }
			<input
				ref={ addFileRef }
				type="file"
				accept=".vtt,.srt"
				style={ { display: 'none' } }
				onChange={ onAddFilePicked }
			/>
			<input
				ref={ replaceFileRef }
				type="file"
				accept=".vtt,.srt"
				style={ { display: 'none' } }
				onChange={ onReplaceFilePicked }
			/>

			{ editing && (
				<CaptionCueEditor
					attachmentID={ attachmentID }
					caption={ editing }
					onClose={ () => setEditing( null ) }
				/>
			) }
		</Modal>
	);
};

export default CaptionManager;
