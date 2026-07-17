/**
 * WordPress dependencies
 */
import { Button, Flex, FlexItem, DropdownMenu, MenuGroup, MenuItem, Tooltip } from '@wordpress/components';
import { useState, useRef, useEffect } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { arrowLeft, copy, seen, chartBar, moreVertical, pencil } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { notify as notifyGuide } from '../../onboarding/productGuide';

/**
 * Click-to-edit video title.
 *
 * Shows the title as a heading; clicking it (or focusing + Enter/Space) swaps in
 * a text input. Committing on Enter or blur calls `onSave` with the trimmed
 * value; Escape cancels and restores the original. An unchanged or empty value
 * is treated as a no-op so we never persist a blank title.
 *
 * @param {Object}   props
 * @param {string}   props.title  Current title to display/edit.
 * @param {Function} props.onSave Called with the new title when the edit commits.
 * @return {JSX.Element} The editable title.
 */
const EditableTitle = ( { title, onSave } ) => {
	const [ isEditing, setIsEditing ] = useState( false );
	const [ draft, setDraft ] = useState( title );
	const inputRef = useRef( null );
	const buttonRef = useRef( null );
	// `editingRef` guards commit/cancel against a double-invocation (the input's
	// blur can fire as it unmounts right after Enter). `refocusRef` records
	// whether focus should return to the trigger button once edit mode ends.
	const editingRef = useRef( false );
	const refocusRef = useRef( false );

	// Keep the draft aligned with upstream title changes while not editing
	// (e.g. after a successful save or an external refresh).
	useEffect( () => {
		if ( ! isEditing ) {
			setDraft( title );
		}
	}, [ title, isEditing ] );

	// Move focus with the mode change: to the field when editing starts, and
	// back to the trigger button when it ends — otherwise blur/Enter/Escape
	// leaves focus on <body> and breaks keyboard flow.
	useEffect( () => {
		if ( isEditing ) {
			inputRef.current?.focus();
			inputRef.current?.select();
		} else if ( refocusRef.current ) {
			refocusRef.current = false;
			buttonRef.current?.focus();
		}
	}, [ isEditing ] );

	const startEditing = () => {
		editingRef.current = true;
		setIsEditing( true );
	};

	const commit = ( refocus ) => {
		if ( ! editingRef.current ) {
			return;
		}
		editingRef.current = false;
		refocusRef.current = refocus;
		setIsEditing( false );

		const trimmed = draft.trim();
		if ( trimmed && trimmed !== title ) {
			onSave( trimmed );
		} else {
			setDraft( title );
		}
	};

	const cancel = () => {
		if ( ! editingRef.current ) {
			return;
		}
		editingRef.current = false;
		refocusRef.current = true;
		setDraft( title );
		setIsEditing( false );
	};

	const handleKeyDown = ( event ) => {
		if ( event.key === 'Enter' ) {
			event.preventDefault();
			commit( true );
		} else if ( event.key === 'Escape' ) {
			event.preventDefault();
			cancel();
		}
	};

	// On blur, only pull focus back to the button when it would otherwise fall
	// to <body>; if the user clicked another control, let focus go there.
	const handleBlur = ( event ) => {
		const goingNowhere = ! event.relatedTarget || event.relatedTarget === document.body;
		commit( goingNowhere );
	};

	if ( isEditing ) {
		return (
			<input
				ref={ inputRef }
				type="text"
				className="godam-video-editor__title-input"
				value={ draft }
				onChange={ ( event ) => setDraft( event.target.value ) }
				onBlur={ handleBlur }
				onKeyDown={ handleKeyDown }
				aria-label={ __( 'Title', 'godam' ) }
				data-test-id="godam-video-editor-title-input"
			/>
		);
	}

	return (
		<h1 className="godam-video-editor__title">
			<button
				ref={ buttonRef }
				type="button"
				className="godam-video-editor__title-button"
				onClick={ startEditing }
				title={ __( 'Click to edit title', 'godam' ) }
				data-test-id="godam-video-editor-title"
			>
				{ title }
			</button>
		</h1>
	);
};

/**
 * Top bar for the video editor shell.
 *
 * Renders the back button, video title + layer count, and the primary
 * actions (Copy, Preview, Save Video) plus a kebab menu (Edit metadata,
 * Analytics). All handlers are passed in from `VideoEditor`.
 *
 * @param {Object}   props
 * @param {string}   props.title             Media title.
 * @param {number}   props.layerCount        Number of layers.
 * @param {number}   props.attachmentID      Attachment ID for Preview/Analytics links.
 * @param {boolean}  props.isChanged         Whether there are unsaved changes.
 * @param {boolean}  props.isSaving          Whether a save is in progress.
 * @param {Object}   props.capability        Active media-type capability descriptor.
 * @param {Function} props.onBack            Back-to-picker handler.
 * @param {Function} props.onSave            Save handler.
 * @param {Function} props.onCopy            Copy-block handler.
 * @param {Function} props.onEditMetadata    Opens the attachment details popup.
 * @param {string}   props.editMetadataLabel Label for the "Edit metadata" menu item.
 * @param {Function} props.onSaveTitle       Persists an edited media title.
 * @return {JSX.Element} The top bar.
 */
const EditorTopBar = ( {
	title,
	layerCount,
	attachmentID,
	isChanged,
	isSaving,
	capability = {},
	onBack,
	onSave,
	onCopy,
	onEditMetadata,
	editMetadataLabel,
	onSaveTitle,
} ) => {
	const homeUrl = window?.godamRestRoute?.homeUrl || '';
	const hasValidApiKey = Boolean( window?.userData?.validApiKey );
	const previewPage = capability.previewPage || 'video-preview';
	// Media types without a front-end preview page (e.g. audio) hide the button.
	const showPreview = capability.showPreview !== false;
	// Copy emits a `copyBlockName` block; hidden for media types whose block
	// isn't available yet (e.g. image, until the `godam/image` block ships).
	const showCopy = capability.showCopy !== false;
	// Analytics is tied to stats support — audio has neither.
	const showAnalytics = hasValidApiKey && capability.showStats !== false;
	// Only media types with a Layers tab show the layer count subtitle.
	const showLayerCount = Array.isArray( capability.tabs ) ? capability.tabs.includes( 'layers' ) : true;
	// Video keeps its historic "Save Video" label; other media types use "Save".
	const saveLabel = capability.mediaType === 'audio' || capability.mediaType === 'image'
		? __( 'Save', 'godam' )
		: __( 'Save Video', 'godam' );
	const previewUrl = `${ homeUrl }?godam_page=${ previewPage }&id=${ attachmentID }`;
	const analyticsUrl = `${ homeUrl }/wp-admin/admin.php?page=rtgodam_analytics&id=${ attachmentID }`;

	/**
	 * Leaving the editor via the back button discards any unsaved layer changes,
	 * so confirm first when there are unsaved changes. Complements the other two
	 * guards: the native `beforeunload` in VideoEditor (tab close / reload /
	 * cross-page navigation) and the `popstate` confirm in App.js (browser
	 * back/forward within the editor), so every exit path warns consistently.
	 */
	const handleBack = () => {
		if ( isChanged ) {
			// eslint-disable-next-line no-alert
			const leave = window.confirm( __( 'You have unsaved changes. Are you sure you want to leave?', 'godam' ) );

			if ( ! leave ) {
				return;
			}
		}

		onBack();
	};

	return (
		<div className="godam-video-editor__topbar">
			<Flex justify="flex-start" align="center" gap={ 2 } expanded={ false }>
				<FlexItem>
					<Button
						icon={ arrowLeft }
						label={ __( 'Back to media library', 'godam' ) }
						onClick={ handleBack }
						data-test-id="godam-video-editor-button-back"
					/>
				</FlexItem>
				<FlexItem>
					<h1 className="godam-video-editor__title">{ title }</h1>
					<EditableTitle title={ title } onSave={ onSaveTitle } />
					{ showLayerCount && (
						<p className="godam-video-editor__subtitle">
							{ sprintf(
								// translators: %d is the number of layers.
								_n( '%d layer', '%d layers', layerCount, 'godam' ),
								layerCount,
							) }
						</p>
					) }
				</FlexItem>
			</Flex>

			<Flex
				className="godam-video-editor__actions"
				justify="flex-end"
				align="center"
				gap={ 2 }
				expanded={ false }
			>
				{ showCopy && (
					<FlexItem>
						<Tooltip
							text={
								<p>
									{ __( 'You can copy the block into one of the two options:', 'godam' ) }
									<br />
									{ __( '1. Insert as a block in the Block editor.', 'godam' ) }
									<br />
									{ __( '2. Insert as HTML content in the Block editor.', 'godam' ) }
								</p>
							}
						>
							<Button
								variant="tertiary"
								icon={ copy }
								onClick={ () => {
									onCopy();
									// Final product-guide step: copying completes the tour
									// and prompts to drop the video into a new page.
									notifyGuide( 'copy' );
								} }
								data-test-id="godam-video-editor-button-copy-block"
							>
								{ __( 'Copy', 'godam' ) }
							</Button>
						</Tooltip>
					</FlexItem>
				) }
				{ showPreview && (
					<FlexItem>
						<Button
							variant="tertiary"
							icon={ seen }
							href={ previewUrl }
							target="_blank"
							data-test-id="godam-video-editor-button-preview"
						>
							{ __( 'Preview', 'godam' ) }
						</Button>
					</FlexItem>
				) }
				<FlexItem>
					<Button
						variant="primary"
						onClick={ () => {
							onSave();
							// Advances the product guide's "save the video" step.
							notifyGuide( 'save-video' );
						} }
						isBusy={ isSaving }
						disabled={ ! isChanged }
						data-test-id="godam-video-editor-button-save"
					>
						{ isSaving ? __( 'Saving…', 'godam' ) : saveLabel }
					</Button>
				</FlexItem>
				<FlexItem>
					<DropdownMenu
						icon={ moreVertical }
						label={ __( 'More options', 'godam' ) }
						toggleProps={ { 'data-test-id': 'godam-video-editor-button-more-options' } }
					>
						{ ( { onClose } ) => (
							<MenuGroup>
								{ showAnalytics && (
									<MenuItem
										icon={ chartBar }
										href={ analyticsUrl }
										target="_blank"
										data-test-id="godam-video-editor-button-analytics"
									>
										{ __( 'Analytics', 'godam' ) }
									</MenuItem>
								) }
								<MenuItem
									icon={ pencil }
									onClick={ () => {
										onEditMetadata();
										onClose();
									} }
									data-test-id="godam-video-editor-button-edit-metadata"
								>
									{ editMetadataLabel }
								</MenuItem>
							</MenuGroup>
						) }
					</DropdownMenu>
				</FlexItem>
			</Flex>
		</div>
	);
};

export default EditorTopBar;
