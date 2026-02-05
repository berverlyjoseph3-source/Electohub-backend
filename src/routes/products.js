const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// Get all products with filters
router.get('/', async (req, res) => {
    try {
        const {
            category,
            brand,
            minPrice,
            maxPrice,
            search,
            sort = 'createdAt',
            page = 1,
            limit = 12,
            featured
        } = req.query;

        // Build filter
        const filter = { isActive: true };
        
        if (category) filter.category = category;
        if (brand) filter.brand = brand;
        if (featured === 'true') filter.isFeatured = true;
        
        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice) filter.price.$gte = Number(minPrice);
            if (maxPrice) filter.price.$lte = Number(maxPrice);
        }

        // Search
        if (search) {
            filter.$text = { $search: search };
        }

        // Calculate pagination
        const skip = (page - 1) * limit;

        // Build sort object
        let sortObj = {};
        if (sort === 'price_asc') sortObj.price = 1;
        else if (sort === 'price_desc') sortObj.price = -1;
        else if (sort === 'name') sortObj.name = 1;
        else if (sort === 'newest') sortObj.createdAt = -1;
        else if (sort === 'popular') sortObj['rating.average'] = -1;
        else sortObj.createdAt = -1;

        // Execute query
        const [products, total] = await Promise.all([
            Product.find(filter)
                .sort(sortObj)
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            Product.countDocuments(filter)
        ]);

        // Calculate pagination info
        const pages = Math.ceil(total / limit);

        res.json({
            success: true,
            data: products,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages,
                hasNext: page < pages,
                hasPrev: page > 1
            }
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch products'
        });
    }
});

// Get single product by ID
router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
            .populate('createdBy', 'firstName lastName')
            .lean();

        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        // Increment view count
        await Product.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });

        res.json({
            success: true,
            data: product
        });
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch product'
        });
    }
});

// Get featured products
router.get('/featured/random', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 8;
        
        const products = await Product.aggregate([
            { $match: { isFeatured: true, isActive: true, isInStock: true } },
            { $sample: { size: limit } }
        ]);

        res.json({
            success: true,
            data: products
        });
    } catch (error) {
        console.error('Error fetching featured products:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch featured products'
        });
    }
});

// Get products by category
router.get('/category/:category', async (req, res) => {
    try {
        const { category } = req.params;
        const { page = 1, limit = 12, sort = 'createdAt' } = req.query;
        const skip = (page - 1) * limit;

        // Build sort object
        let sortObj = {};
        if (sort === 'price_asc') sortObj.price = 1;
        else if (sort === 'price_desc') sortObj.price = -1;
        else if (sort === 'name') sortObj.name = 1;
        else if (sort === 'newest') sortObj.createdAt = -1;
        else sortObj.createdAt = -1;

        const [products, total] = await Promise.all([
            Product.find({ 
                category,
                isActive: true 
            })
            .sort(sortObj)
            .skip(skip)
            .limit(Number(limit))
            .lean(),
            Product.countDocuments({ category, isActive: true })
        ]);

        const pages = Math.ceil(total / limit);

        res.json({
            success: true,
            data: products,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages,
                hasNext: page < pages,
                hasPrev: page > 1
            }
        });
    } catch (error) {
        console.error('Error fetching category products:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch products'
        });
    }
});

// Search products
router.get('/search/:query', async (req, res) => {
    try {
        const { query } = req.params;
        const { page = 1, limit = 12 } = req.query;
        const skip = (page - 1) * limit;

        const [products, total] = await Promise.all([
            Product.find(
                { $text: { $search: query }, isActive: true },
                { score: { $meta: 'textScore' } }
            )
            .sort({ score: { $meta: 'textScore' } })
            .skip(skip)
            .limit(Number(limit))
            .lean(),
            Product.countDocuments({ $text: { $search: query }, isActive: true })
        ]);

        const pages = Math.ceil(total / limit);

        res.json({
            success: true,
            data: products,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages,
                hasNext: page < pages,
                hasPrev: page > 1
            }
        });
    } catch (error) {
        console.error('Error searching products:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to search products'
        });
    }
});

// Get related products
router.get('/:id/related', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        const relatedProducts = await Product.find({
            _id: { $ne: product._id },
            $or: [
                { category: product.category },
                { brand: product.brand },
                { tags: { $in: product.tags } }
            ],
            isActive: true,
            isInStock: true
        })
        .limit(4)
        .lean();

        res.json({
            success: true,
            data: relatedProducts
        });
    } catch (error) {
        console.error('Error fetching related products:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch related products'
        });
    }
});

module.exports = router;