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
import { __ } from '@wordpress/i18n';
import { plus, trash, update, download, check } from '@wordpress/icons';

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
import CaptionCueEditor from './CaptionCueEditor';

const FREE_TEXT = '__other__';

/**
 * Read a picked caption File into text + detected source format.
 *
 * @param {File} file The chosen .vtt / .srt file.
 * @return {Promise<{content:string,sourceFormat:string}>} File text and format.
 */
const readCaptionFile = ( file ) =>
	new Promise( ( resolve, reject ) => {
		const reader = new FileReader();
		reader.onload = () => {
			const ext = ( file.name.split( '.' ).pop() || '' ).toLowerCase();
			resolve( {
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
	const captions = Array.isArray( data?.captions ) ? data.captions : [];

	const resolvedLanguage = form.language === FREE_TEXT ? form.freeLang.trim() : form.language;

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
		try {
			await uploadCaption( {
				attachmentID,
				content: pendingFile.content,
				sourceFormat: pendingFile.sourceFormat,
				language: resolvedLanguage,
				label: form.label.trim() || languageLabel( resolvedLanguage ),
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

			{ isError && (
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
									<span className="godam-ve-caption-manager__label">
										{ caption.label || languageLabel( caption.language ) }
									</span>
									<span className="godam-ve-caption-manager__sub">
										{ [
											caption.language,
											isUploaded ? __( 'Uploaded', 'godam' ) : __( 'Generated', 'godam' ),
											caption.cue_count
												? `${ caption.cue_count } ${ __( 'cues', 'godam' ) }`
												: '',
											caption.is_default ? __( 'Default', 'godam' ) : '',
										]
											.filter( Boolean )
											.join( ' • ' ) }
									</span>
								</div>
								<div className="godam-ve-caption-manager__actions">
									{ rowBusy && <Spinner /> }
									<Button
										icon={ check }
										label={ __( 'Set as default', 'godam' ) }
										showTooltip
										disabled={ caption.is_default || rowBusy }
										onClick={ () => handleSetDefault( id ) }
									/>
									<Button
										icon={ update }
										label={ __( 'Edit captions', 'godam' ) }
										showTooltip
										disabled={ ! canEditCues || rowBusy || ! caption.vtt_path }
										onClick={ () => setEditing( caption ) }
									/>
									<Button
										icon={ plus }
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
			{ showAdd ? (
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
								onChange={ ( label ) => setForm( ( f ) => ( { ...f, label } ) ) }
							/>
						</FlexItem>
					</Flex>
					<div className="godam-ve-caption-manager__add-row">
						<Button variant="secondary" onClick={ () => addFileRef.current?.click() }>
							{ pendingFile ? __( 'File selected', 'godam' ) : __( 'Choose file', 'godam' ) }
						</Button>
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
							disabled={ isUploading }
							onClick={ handleAdd }
						>
							{ __( 'Add caption', 'godam' ) }
						</Button>
					</div>
				</div>
			) : (
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
