/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable @wordpress/no-unsafe-wp-apis */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import {
	useBlockProps,
	InspectorControls,
	InnerBlocks,
	store as blockEditorStore,
} from '@wordpress/block-editor';
import {
	PanelBody,
	RangeControl,
	__experimentalToggleGroupControl as ToggleGroupControl,
	__experimentalToggleGroupControlOption as ToggleGroupControlOption,
	__experimentalToggleGroupControlOptionIcon as ToggleGroupControlOptionIcon,
} from '@wordpress/components';
import { useEffect } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { columns, grid } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import './editor.scss';

/**
 * The edit function for GoDAM Video Product Gallery block.
 *
 * @param {Object}   props               Block props.
 * @param {Object}   props.attributes    Block attributes.
 * @param {Function} props.setAttributes Function to set block attributes.
 * @param {string}   props.clientId      Block client ID.
 * @return {JSX.Element} Element to render.
 */
export default function Edit( { attributes, setAttributes, clientId } ) {
	const { blockId, layout, viewRatio, itemWidth, gap } = attributes;

	// Set the Block id of the Block as ClientId.
	useEffect( () => {
		if ( ! blockId ) {
			setAttributes( { blockId: clientId } );
		}
	}, [ clientId, blockId, setAttributes ] );

	// Get inner blocks count
	const { hasInnerBlocks } = useSelect(
		( select ) => {
			const { getBlock } = select( blockEditorStore );
			const block = getBlock( clientId );
			return {
				hasInnerBlocks: !! ( block && block.innerBlocks.length ),
			};
		},
		[ clientId ],
	);

	const blockProps = useBlockProps( {
		className: `godam-video-product-gallery godam-video-product-gallery--${ layout }`,
		style: {
			'--godam-gallery-item-width': `${ itemWidth }px`,
			'--godam-gallery-gap': `${ gap }px`,
		},
	} );

	// Template for InnerBlocks - starts with one item
	const TEMPLATE = [ [ 'godam/video-product-gallery-item', {} ] ];

	// Allowed blocks - only gallery items
	const ALLOWED_BLOCKS = [ 'godam/video-product-gallery-item' ];

	return (
		<>
			<InspectorControls>
				<PanelBody title={ __( 'Gallery Settings', 'godam' ) } initialOpen={ true }>
					{ /* Layout Selector with Icons */ }
					<ToggleGroupControl
						__nextHasNoMarginBottom
						isBlock
						label={ __( 'Layout', 'godam' ) }
						value={ layout }
						onChange={ ( value ) => setAttributes( { layout: value } ) }
					>
						<ToggleGroupControlOptionIcon
							icon={ columns }
							label={ __( 'Carousel', 'godam' ) }
							value="carousel"
						/>
						<ToggleGroupControlOptionIcon
							icon={ grid }
							label={ __( 'Grid', 'godam' ) }
							value="grid"
						/>
					</ToggleGroupControl>

					{ /* View Ratio Selector */ }
					<ToggleGroupControl
						__nextHasNoMarginBottom
						isBlock
						label={ __( 'View Ratio', 'godam' ) }
						value={ viewRatio }
						onChange={ ( value ) => setAttributes( { viewRatio: value } ) }
					>
						<ToggleGroupControlOption label="4:3" value="4:3" />
						<ToggleGroupControlOption label="9:16" value="9:16" />
						<ToggleGroupControlOption label="3:4" value="3:4" />
						<ToggleGroupControlOption label="1:1" value="1:1" />
						<ToggleGroupControlOption label="16:9" value="16:9" />
					</ToggleGroupControl>
				</PanelBody>

				<PanelBody title={ __( 'Style Settings', 'godam' ) } initialOpen={ false }>
					<RangeControl
						__nextHasNoMarginBottom
						label={ __( 'Item Width', 'godam' ) }
						value={ itemWidth }
						onChange={ ( value ) => setAttributes( { itemWidth: value } ) }
						min={ 100 }
						max={ 400 }
						step={ 10 }
						help={ __( 'Width of each gallery item in pixels.', 'godam' ) }
					/>
					<RangeControl
						__nextHasNoMarginBottom
						label={ __( 'Gap', 'godam' ) }
						value={ gap }
						onChange={ ( value ) => setAttributes( { gap: value } ) }
						min={ 0 }
						max={ 48 }
						step={ 4 }
						help={ __( 'Spacing between gallery items.', 'godam' ) }
					/>
				</PanelBody>
			</InspectorControls>

			<div { ...blockProps }>
				<InnerBlocks
					allowedBlocks={ ALLOWED_BLOCKS }
					template={ hasInnerBlocks ? undefined : TEMPLATE }
					orientation={ layout === 'carousel' ? 'horizontal' : 'vertical' }
					renderAppender={ InnerBlocks.ButtonBlockAppender }
				/>
			</div>
		</>
	);
}
