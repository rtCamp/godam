import { __ } from '@wordpress/i18n';
import
    {
        useBlockProps,
        InspectorControls,
        MediaUpload,
        MediaUploadCheck
    } from '@wordpress/block-editor';
import
    {
        PanelBody,
        SelectControl,
        RangeControl,
        TextControl,
        TextareaControl,
        Button,
        Notice,
        Spinner,
        Divider,
        Card,
        CardBody
    } from '@wordpress/components';
import { useState } from '@wordpress/element';

const ALLOWED_MEDIA_TYPES = [ 'image' ];

import './editor.scss';

export default function Edit( { attributes, setAttributes } )
{
    const {
        productImages = [],
        generatedVideoUrl = '',
        isGenerating = false,
        videoTitle = '',
        videoDescription = '',
        aiModel = 'runway',
        videoStyle = 'product-showcase',
        videoDuration = 15,
        apiEndpoint = '',
        apiKey = ''
    } = attributes;

    const [ error, setError ] = useState( '' );
    const [ progress, setProgress ] = useState( 0 );
    const [ validationErrors, setValidationErrors ] = useState( {} );

    const blockProps = useBlockProps( {
        className: 'wp-block-godam-video-generator'
    } );

    // Configuration options
    const aiModelOptions = [
        { label: __( 'Runway ML Gen-3', 'godam-video-generator' ), value: 'runway' },
        { label: __( 'Stable Video Diffusion', 'godam-video-generator' ), value: 'stable-video' },
        { label: __( 'Pika Labs', 'godam-video-generator' ), value: 'pika' },
        { label: __( 'LeiaPix', 'godam-video-generator' ), value: 'leiapix' },
        { label: __( 'Custom API', 'godam-video-generator' ), value: 'custom' }
    ];

    const videoStyleOptions = [
        { label: __( 'Product Showcase', 'godam-video-generator' ), value: 'product-showcase' },
        { label: __( 'Lifestyle Ad', 'godam-video-generator' ), value: 'lifestyle' },
        { label: __( 'Minimalist', 'godam-video-generator' ), value: 'minimalist' },
        { label: __( 'Dynamic Motion', 'godam-video-generator' ), value: 'dynamic' },
        { label: __( 'Brand Story', 'godam-video-generator' ), value: 'brand-story' },
        { label: __( 'Social Media Ad', 'godam-video-generator' ), value: 'social-media' }
    ];

    // Validation functions
    const validateForm = () =>
    {
        const errors = {};

        if ( productImages.length === 0 )
        {
            errors.images = __( 'Please select at least one product image.', 'godam-video-generator' );
        }

        if ( !videoTitle.trim() )
        {
            errors.title = __( 'Video title is required.', 'godam-video-generator' );
        }

        if ( !videoDescription.trim() )
        {
            errors.description = __( 'Video description is required.', 'godam-video-generator' );
        }

        if ( !apiEndpoint.trim() )
        {
            errors.apiEndpoint = __( 'API endpoint is required.', 'godam-video-generator' );
        }

        if ( !apiKey.trim() )
        {
            errors.apiKey = __( 'API key is required.', 'godam-video-generator' );
        }

        setValidationErrors( errors );
        return Object.keys( errors ).length === 0;
    };

    // Media handling
    const onSelectImages = ( media ) =>
    {
        const images = media.map( item => ( {
            id: item.id,
            url: item.url,
            alt: item.alt || '',
            caption: item.caption || '',
            filename: item.filename || ''
        } ) );
        setAttributes( { productImages: images } );
        setError( '' );

        // Clear validation error for images
        if ( validationErrors.images )
        {
            const newErrors = { ...validationErrors };
            delete newErrors.images;
            setValidationErrors( newErrors );
        }
    };

    const removeImage = ( indexToRemove ) =>
    {
        const updatedImages = productImages.filter( ( _, index ) => index !== indexToRemove );
        setAttributes( { productImages: updatedImages } );
    };

    // API call to third-party service
    const generateVideo = async () =>
    {
        if ( !validateForm() )
        {
            setError( __( 'Please fix the validation errors before generating video.', 'godam-video-generator' ) );
            return;
        }

        setAttributes( { isGenerating: true } );
        setError( '' );
        setProgress( 0 );

        try
        {
            // Progress simulation
            const progressInterval = setInterval( () =>
            {
                setProgress( prev =>
                {
                    if ( prev < 90 ) return prev + Math.random() * 15;
                    return prev;
                } );
            }, 2000 );

            // Prepare form data for third-party API
            const formData = new FormData();

            // Add images to form data
            productImages.forEach( ( image, index ) =>
            {
                formData.append( `images[${ index }]`, image.url );
            } );

            // Add other parameters
            formData.append( 'title', videoTitle );
            formData.append( 'description', videoDescription );
            formData.append( 'ai_model', aiModel );
            formData.append( 'video_style', videoStyle );
            formData.append( 'duration', videoDuration );

            // Make request to third-party API
            const response = await fetch( apiEndpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${ apiKey }`,
                    'Accept': 'application/json',
                },
                body: formData
            } );

            const data = await response.json();

            clearInterval( progressInterval );
            setProgress( 100 );

            if ( response.ok && data.success )
            {
                setAttributes( {
                    generatedVideoUrl: data.video_url || data.videoUrl,
                    isGenerating: false
                } );
            } else
            {
                throw new Error( data.message || data.error || __( 'Video generation failed', 'godam-video-generator' ) );
            }

        } catch ( err )
        {
            console.error( 'Video generation error:', err );
            setError( err.message || __( 'An error occurred during video generation', 'godam-video-generator' ) );
            setAttributes( { isGenerating: false } );
            setProgress( 0 );
        }
    };

    const resetGeneration = () =>
    {
        setAttributes( { generatedVideoUrl: '' } );
        setProgress( 0 );
        setError( '' );
    };

    return (
        <>
            <InspectorControls>
                <PanelBody title={ __( 'API Configuration', 'godam-video-generator' ) } initialOpen={ false }>
                    <TextControl
                        label={ __( 'API Endpoint URL', 'godam-video-generator' ) }
                        value={ apiEndpoint }
                        onChange={ ( value ) => setAttributes( { apiEndpoint: value } ) }
                        placeholder="https://api.example.com/generate-video"
                        help={ __( 'Enter the third-party API endpoint URL', 'godam-video-generator' ) }
                        className={ validationErrors.apiEndpoint ? 'has-error' : '' }
                    />
                    { validationErrors.apiEndpoint && (
                        <Notice status="error" isDismissible={ false }>
                            { validationErrors.apiEndpoint }
                        </Notice>
                    ) }

                    <TextControl
                        label={ __( 'API Key', 'godam-video-generator' ) }
                        value={ apiKey }
                        onChange={ ( value ) => setAttributes( { apiKey: value } ) }
                        type="password"
                        placeholder="Enter your API key"
                        help={ __( 'Your API authentication key', 'godam-video-generator' ) }
                        className={ validationErrors.apiKey ? 'has-error' : '' }
                    />
                    { validationErrors.apiKey && (
                        <Notice status="error" isDismissible={ false }>
                            { validationErrors.apiKey }
                        </Notice>
                    ) }
                </PanelBody>

                <PanelBody title={ __( 'Video Settings', 'godam-video-generator' ) } initialOpen={ true }>
                    <SelectControl
                        label={ __( 'AI Model', 'godam-video-generator' ) }
                        value={ aiModel }
                        options={ aiModelOptions }
                        onChange={ ( value ) => setAttributes( { aiModel: value } ) }
                        help={ __( 'Choose the AI model for video generation', 'godam-video-generator' ) }
                    />

                    <SelectControl
                        label={ __( 'Video Style', 'godam-video-generator' ) }
                        value={ videoStyle }
                        options={ videoStyleOptions }
                        onChange={ ( value ) => setAttributes( { videoStyle: value } ) }
                        help={ __( 'Select the style of advertisement video', 'godam-video-generator' ) }
                    />

                    <RangeControl
                        label={ __( 'Video Duration (seconds)', 'godam-video-generator' ) }
                        value={ videoDuration }
                        onChange={ ( value ) => setAttributes( { videoDuration: value } ) }
                        min={ 5 }
                        max={ 60 }
                        step={ 5 }
                        marks={ [
                            { value: 5, label: '5s' },
                            { value: 15, label: '15s' },
                            { value: 30, label: '30s' },
                            { value: 60, label: '60s' }
                        ] }
                    />
                </PanelBody>

                <PanelBody title={ __( 'Content Settings', 'godam-video-generator' ) } initialOpen={ true }>
                    <TextControl
                        label={ __( 'Video Title', 'godam-video-generator' ) }
                        value={ videoTitle }
                        onChange={ ( value ) => setAttributes( { videoTitle: value } ) }
                        placeholder={ __( 'Enter video title...', 'godam-video-generator' ) }
                        className={ validationErrors.title ? 'has-error' : '' }
                    />
                    { validationErrors.title && (
                        <Notice status="error" isDismissible={ false }>
                            { validationErrors.title }
                        </Notice>
                    ) }

                    <TextareaControl
                        label={ __( 'Video Description', 'godam-video-generator' ) }
                        value={ videoDescription }
                        onChange={ ( value ) => setAttributes( { videoDescription: value } ) }
                        placeholder={ __( 'Describe the video content...', 'godam-video-generator' ) }
                        help={ __( 'This helps the AI generate more relevant content', 'godam-video-generator' ) }
                        rows={ 4 }
                        className={ validationErrors.description ? 'has-error' : '' }
                    />
                    { validationErrors.description && (
                        <Notice status="error" isDismissible={ false }>
                            { validationErrors.description }
                        </Notice>
                    ) }
                </PanelBody>
            </InspectorControls>

            <div { ...blockProps }>
                <Card className="godam-video-generator-card">
                    <CardBody>
                        <div className="godam-video-generator-header">
                            <h3>{ __( 'Godam AI Video Generator', 'godam-video-generator' ) }</h3>
                            <p className="description">
                                { __( 'Create engaging advertisement videos from your product images using AI', 'godam-video-generator' ) }
                            </p>
                        </div>

                        { error && (
                            <Notice status="error" isDismissible onRemove={ () => setError( '' ) }>
                                { error }
                            </Notice>
                        ) }

                        <div className="godam-image-section">
                            <h4>{ __( 'Product Images', 'godam-video-generator' ) }</h4>

                            <MediaUploadCheck>
                                <MediaUpload
                                    onSelect={ onSelectImages }
                                    allowedTypes={ ALLOWED_MEDIA_TYPES }
                                    multiple={ true }
                                    gallery={ true }
                                    value={ productImages.map( img => img.id ) }
                                    render={ ( { open } ) => (
                                        <Button
                                            onClick={ open }
                                            variant="secondary"
                                            className="godam-upload-button"
                                            icon="camera"
                                        >
                                            { productImages.length === 0
                                                ? __( 'Select Product Images', 'godam-video-generator' )
                                                : __( 'Change Images', 'godam-video-generator' )
                                            }
                                        </Button>
                                    ) }
                                />
                            </MediaUploadCheck>

                            { validationErrors.images && (
                                <Notice status="error" isDismissible={ false }>
                                    { validationErrors.images }
                                </Notice>
                            ) }

                            { productImages.length > 0 && (
                                <div className="godam-selected-images">
                                    <p className="images-count">
                                        { __( 'Selected Images:', 'godam-video-generator' ) } { productImages.length }
                                    </p>
                                    <div className="godam-image-grid">
                                        { productImages.map( ( image, index ) => (
                                            <div key={ image.id } className="godam-image-item">
                                                <img src={ image.url } alt={ image.alt } />
                                                <Button
                                                    onClick={ () => removeImage( index ) }
                                                    variant="secondary"
                                                    isDestructive
                                                    size="small"
                                                    className="godam-remove-image"
                                                    icon="no-alt"
                                                >
                                                    { __( 'Remove', 'godam-video-generator' ) }
                                                </Button>
                                                <div className="image-name">{ image.filename }</div>
                                            </div>
                                        ) ) }
                                    </div>
                                </div>
                            ) }
                        </div>

                        <div className="godam-generation-section">
                            <Button
                                onClick={ generateVideo }
                                variant="primary"
                                disabled={ isGenerating }
                                className="godam-generate-button"
                                icon={ isGenerating ? "update" : "video-alt3" }
                            >
                                { isGenerating
                                    ? __( 'Generating Video...', 'godam-video-generator' )
                                    : __( 'Generate Advertisement Video', 'godam-video-generator' )
                                }
                            </Button>

                            { isGenerating && (
                                <div className="godam-generation-progress">
                                    <div className="progress-content">
                                        <Spinner />
                                        <div className="progress-text">
                                            <p>{ __( 'Processing images and generating video...', 'godam-video-generator' ) }</p>
                                            <span className="progress-percentage">{ Math.round( progress ) }%</span>
                                        </div>
                                    </div>
                                    <div className="godam-progress-bar">
                                        <div
                                            className="godam-progress-fill"
                                            style={ { width: `${ progress }%` } }
                                        ></div>
                                    </div>
                                </div>
                            ) }
                        </div>

                        { generatedVideoUrl && (
                            <div className="godam-generated-video-section">
                                <h4>{ __( 'Generated Advertisement Video', 'godam-video-generator' ) }</h4>
                                <div className="godam-video-container">
                                    <video
                                        controls
                                        className="godam-generated-video"
                                        poster=""
                                    >
                                        <source src={ generatedVideoUrl } type="video/mp4" />
                                        { __( 'Your browser does not support the video tag.', 'godam-video-generator' ) }
                                    </video>
                                </div>

                                <div className="godam-video-actions">
                                    <Button
                                        variant="secondary"
                                        onClick={ () => window.open( generatedVideoUrl, '_blank' ) }
                                        icon="download"
                                    >
                                        { __( 'Download Video', 'godam-video-generator' ) }
                                    </Button>

                                    <Button
                                        variant="tertiary"
                                        onClick={ resetGeneration }
                                        icon="update"
                                    >
                                        { __( 'Generate New Video', 'godam-video-generator' ) }
                                    </Button>
                                </div>
                            </div>
                        ) }

                        <div className="godam-info-section">
                            <div className="godam-model-info">
                                <strong>{ __( 'Current AI Model:', 'godam-video-generator' ) }</strong>{ ' ' }
                                { aiModelOptions.find( opt => opt.value === aiModel )?.label }
                            </div>
                            <div className="godam-style-info">
                                <strong>{ __( 'Video Style:', 'godam-video-generator' ) }</strong>{ ' ' }
                                { videoStyleOptions.find( opt => opt.value === videoStyle )?.label }
                            </div>
                        </div>
                    </CardBody>
                </Card>
            </div>
        </>
    );
}