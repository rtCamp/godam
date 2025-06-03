/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { useBlockProps, InspectorControls } from '@wordpress/block-editor';
import { PanelBody, SelectControl, RangeControl, ToggleControl } from '@wordpress/components';

/**
 * Internal dependencies
 */
import './editor.scss';

/**
 * The edit function describes the structure of your block in the context of the
 * editor. This represents what the editor will render when the block is used.
 *
 * @param {Object}   props               Block props.
 * @param {Object}   props.attributes    Block attributes.
 * @param {Function} props.setAttributes Function to set block attributes.
 * @return {WPElement} Element to render.
 */
export default function Edit( { attributes, setAttributes } ) {
	const { columns, count, orderby, order, infiniteScroll } = attributes;
	const blockProps = useBlockProps();

	// Generate sample video containers
	const GoDAMVideos = Array.from( { length: count }, ( _, i ) => (
		<div className="godam-editor-video-item" key={ i }>
			<div className="godam-editor-video-thumbnail">
				<span className="godam-editor-video-label">
					{ __( 'GoDAM Video', 'godam' ) }
				</span>
			</div>
		</div>
	) );

	return (
		<>
			<InspectorControls>
				<PanelBody title={ __( 'Gallery Settings', 'godam' ) }>
					<RangeControl
						label={ __( 'Number of columns', 'godam' ) }
						value={ columns }
						onChange={ ( value ) => setAttributes( { columns: value } ) }
						min={ 1 }
						max={ 6 }
					/>
					<RangeControl
						label={ __( 'Number of videos', 'godam' ) }
						value={ count }
						onChange={ ( value ) => setAttributes( { count: value } ) }
						min={ 1 }
						max={ 30 }
					/>
					<SelectControl
						label={ __( 'Order by', 'godam' ) }
						value={ orderby }
						options={ [
							{ label: __( 'Date', 'godam' ), value: 'date' },
							{ label: __( 'Title', 'godam' ), value: 'title' },
							{ label: __( 'Random', 'godam' ), value: 'rand' },
						] }
						onChange={ ( value ) => setAttributes( { orderby: value } ) }
					/>
					<SelectControl
						label={ __( 'Order', 'godam' ) }
						value={ order }
						options={ [
							{ label: __( 'Descending', 'godam' ), value: 'DESC' },
							{ label: __( 'Ascending', 'godam' ), value: 'ASC' },
						] }
						onChange={ ( value ) => setAttributes( { order: value } ) }
					/>
					<ToggleControl
						label={ __( 'Enable Infinite Scroll', 'godam' ) }
						checked={ !! infiniteScroll }
						onChange={ ( value ) => setAttributes( { infiniteScroll: value } ) }
					/>
				</PanelBody>
			</InspectorControls>
			<div
				{ ...blockProps }
			>
				<div className={ `godam-editor-video-gallery columns-${ columns }` }>
					{ GoDAMVideos }
				</div>

			</div>
		</>
	);
}
