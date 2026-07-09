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

	// Keep the draft aligned with upstream title changes while not editing
	// (e.g. after a successful save or an external refresh).
	useEffect( () => {
		if ( ! isEditing ) {
			setDraft( title );
		}
	}, [ title, isEditing ] );

	// Focus and select the field when entering edit mode.
	useEffect( () => {
		if ( isEditing && inputRef.current ) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [ isEditing ] );

	const commit = () => {
		setIsEditing( false );
		const trimmed = draft.trim();
		if ( trimmed && trimmed !== title ) {
			onSave( trimmed );
		} else {
			setDraft( title );
		}
	};

	const cancel = () => {
		setDraft( title );
		setIsEditing( false );
	};

	const handleKeyDown = ( event ) => {
		if ( event.key === 'Enter' ) {
			event.preventDefault();
			commit();
		} else if ( event.key === 'Escape' ) {
			event.preventDefault();
			cancel();
		}
	};

	if ( isEditing ) {
		return (
			<input
				ref={ inputRef }
				type="text"
				className="godam-video-editor__title-input"
				value={ draft }
				onChange={ ( event ) => setDraft( event.target.value ) }
				onBlur={ commit }
				onKeyDown={ handleKeyDown }
				aria-label={ __( 'Video title', 'godam' ) }
				data-test-id="godam-video-editor-title-input"
			/>
		);
	}

	return (
		<h1 className="godam-video-editor__title">
			<button
				type="button"
				className="godam-video-editor__title-button"
				onClick={ () => setIsEditing( true ) }
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
 * @param {string}   props.title             Video title.
 * @param {number}   props.layerCount        Number of layers.
 * @param {number}   props.attachmentID      Attachment ID for Preview/Analytics links.
 * @param {boolean}  props.isChanged         Whether there are unsaved changes.
 * @param {boolean}  props.isSaving          Whether a save is in progress.
 * @param {Function} props.onBack            Back-to-picker handler.
 * @param {Function} props.onSave            Save handler.
 * @param {Function} props.onCopy            Copy-block handler.
 * @param {Function} props.onEditMetadata    Opens the attachment details popup.
 * @param {string}   props.editMetadataLabel Label for the "Edit metadata" menu item.
 * @param {Function} props.onSaveTitle       Persists an edited video title.
 * @return {JSX.Element} The top bar.
 */
const EditorTopBar = ( {
	title,
	layerCount,
	attachmentID,
	isChanged,
	isSaving,
	onBack,
	onSave,
	onCopy,
	onEditMetadata,
	editMetadataLabel,
	onSaveTitle,
} ) => {
	const homeUrl = window?.godamRestRoute?.homeUrl || '';
	const previewUrl = `${ homeUrl }?godam_page=video-preview&id=${ attachmentID }`;
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
					<EditableTitle title={ title } onSave={ onSaveTitle } />
					<p className="godam-video-editor__subtitle">
						{ sprintf(
							// translators: %d is the number of layers.
							_n( '%d layer', '%d layers', layerCount, 'godam' ),
							layerCount,
						) }
					</p>
				</FlexItem>
			</Flex>

			<Flex
				className="godam-video-editor__actions"
				justify="flex-end"
				align="center"
				gap={ 2 }
				expanded={ false }
			>
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
						{ isSaving ? __( 'Saving…', 'godam' ) : __( 'Save Video', 'godam' ) }
					</Button>
				</FlexItem>
				<FlexItem>
					<DropdownMenu
						icon={ moreVertical }
						label={ __( 'More options', 'godam' ) }
					>
						{ ( { onClose } ) => (
							<MenuGroup>
								<MenuItem
									icon={ chartBar }
									href={ analyticsUrl }
									target="_blank"
									data-test-id="godam-video-editor-button-analytics"
								>
									{ __( 'Analytics', 'godam' ) }
								</MenuItem>
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
