/**
 * WordPress dependencies
 */
import { Button, Flex, FlexItem, DropdownMenu, MenuGroup, MenuItem, Tooltip } from '@wordpress/components';
import { __, _n, sprintf } from '@wordpress/i18n';
import { arrowLeft, copy, seen, chartBar, moreVertical } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { notify as notifyGuide } from '../../onboarding/productGuide';

/**
 * Top bar for the video editor shell.
 *
 * Renders the back button, video title + layer count, and the primary
 * actions (Copy, Preview, Save Video) plus a kebab menu (Analytics).
 * All handlers are passed in from `VideoEditor` so behaviour is unchanged.
 *
 * @param {Object}   props
 * @param {string}   props.title        Video title.
 * @param {number}   props.layerCount   Number of layers.
 * @param {number}   props.attachmentID Attachment ID for Preview/Analytics links.
 * @param {boolean}  props.isChanged    Whether there are unsaved changes.
 * @param {boolean}  props.isSaving     Whether a save is in progress.
 * @param {Function} props.onBack       Back-to-picker handler.
 * @param {Function} props.onSave       Save handler.
 * @param {Function} props.onCopy       Copy-block handler.
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
} ) => {
	const homeUrl = window?.godamRestRoute?.homeUrl || '';
	const hasValidApiKey = Boolean( window?.userData?.validApiKey );
	const previewUrl = `${ homeUrl }?godam_page=video-preview&id=${ attachmentID }`;
	const analyticsUrl = `${ homeUrl }/wp-admin/admin.php?page=rtgodam_analytics&id=${ attachmentID }`;

	/**
	 * Leaving the editor via the back button discards any unsaved layer changes,
	 * so confirm first when there are unsaved changes. Mirrors the native
	 * `beforeunload` guard in VideoEditor (tab close / reload / browser back) so
	 * every exit path warns consistently.
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
				{ hasValidApiKey && (
					<FlexItem>
						<DropdownMenu
							icon={ moreVertical }
							label={ __( 'More options', 'godam' ) }
						>
							{ () => (
								<MenuGroup>
									<MenuItem
										icon={ chartBar }
										href={ analyticsUrl }
										target="_blank"
										data-test-id="godam-video-editor-button-analytics"
									>
										{ __( 'Analytics', 'godam' ) }
									</MenuItem>
								</MenuGroup>
							) }
						</DropdownMenu>
					</FlexItem>
				) }
			</Flex>
		</div>
	);
};

export default EditorTopBar;
