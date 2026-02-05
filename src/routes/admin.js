const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const jwt = require('jsonwebtoken');

// Middleware to verify admin token
const verifyAdmin = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'No token provided'
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
        
        // Find user
        const user = await User.findById(decoded.userId);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Admin access required'
            });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Admin auth error:', error);
        res.status(401).json({
            success: false,
            error: 'Authentication failed'
        });
    }
};

// Apply admin middleware to all routes
router.use(verifyAdmin);

// Admin dashboard stats
router.get('/dashboard/stats', async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 7);
        
        const lastMonth = new Date(today);
        lastMonth.setMonth(lastMonth.getMonth() - 1);

        // Get all stats in parallel
        const [
            totalUsers,
            newUsersToday,
            totalProducts,
            totalOrders,
            totalRevenue,
            lowStockProducts,
            pendingOrders
        ] = await Promise.all([
            // Users
            User.countDocuments(),
            User.countDocuments({ createdAt: { $gte: today } }),
            
            // Products
            Product.countDocuments({ isActive: true }),
            
            // Orders
            Order.countDocuments(),
            
            // Revenue (sum of all delivered orders)
            Order.aggregate([
                { $match: { status: 'delivered', paymentStatus: 'completed' } },
                { $group: { _id: null, total: { $sum: '$total' } } }
            ]),
            
            // Low stock products
            Product.countDocuments({ stock: { $lt: 10 }, isActive: true }),
            
            // Pending orders
            Order.countDocuments({ status: 'pending' })
        ]);

        // Recent orders
        const recentOrders = await Order.find()
            .sort('-createdAt')
            .limit(5)
            .populate('user', 'firstName lastName email')
            .lean();

        // Top selling products
        const topProducts = await Product.find({ isActive: true })
            .sort('-salesCount')
            .limit(5)
            .lean();

        res.json({
            success: true,
            data: {
                overview: {
                    totalUsers,
                    newUsersToday,
                    totalProducts,
                    totalOrders,
                    totalRevenue: totalRevenue[0]?.total || 0,
                    lowStockProducts,
                    pendingOrders
                },
                recentOrders,
                topProducts
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch dashboard stats'
        });
    }
});

// Get all users
router.get('/users', async (req, res) => {
    try {
        const { page = 1, limit = 20, search, role } = req.query;
        const skip = (page - 1) * limit;

        // Build filter
        const filter = {};
        if (role) filter.role = role;
        if (search) {
            filter.$or = [
                { email: { $regex: search, $options: 'i' } },
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } }
            ];
        }

        const [users, total] = await Promise.all([
            User.find(filter)
                .select('-password')
                .sort('-createdAt')
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            User.countDocuments(filter)
        ]);

        const pages = Math.ceil(total / limit);

        res.json({
            success: true,
            data: users,
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
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch users'
        });
    }
});

// Update user
router.put('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { firstName, lastName, phone, address, role, isActive } = req.body;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Update fields
        if (firstName !== undefined) user.firstName = firstName;
        if (lastName !== undefined) user.lastName = lastName;
        if (phone !== undefined) user.phone = phone;
        if (address !== undefined) user.address = address;
        if (role !== undefined) user.role = role;
        if (isActive !== undefined) user.isActive = isActive;

        await user.save();

        res.json({
            success: true,
            data: {
                id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                phone: user.phone,
                isActive: user.isActive,
                createdAt: user.createdAt
            },
            message: 'User updated successfully'
        });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update user'
        });
    }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Don't delete, just deactivate
        user.isActive = false;
        await user.save();

        res.json({
            success: true,
            message: 'User deactivated successfully'
        });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete user'
        });
    }
});

// Get all products (admin view)
router.get('/products', async (req, res) => {
    try {
        const { page = 1, limit = 20, search, category, isActive } = req.query;
        const skip = (page - 1) * limit;

        // Build filter
        const filter = {};
        if (category) filter.category = category;
        if (isActive !== undefined) filter.isActive = isActive === 'true';
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { brand: { $regex: search, $options: 'i' } },
                { model: { $regex: search, $options: 'i' } }
            ];
        }

        const [products, total] = await Promise.all([
            Product.find(filter)
                .populate('createdBy', 'firstName lastName')
                .sort('-createdAt')
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            Product.countDocuments(filter)
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
        console.error('Error fetching products:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch products'
        });
    }
});

// Update product
router.put('/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        // Update fields
        Object.keys(updates).forEach(key => {
            if (updates[key] !== undefined) {
                product[key] = updates[key];
            }
        });

        await product.save();

        res.json({
            success: true,
            data: product,
            message: 'Product updated successfully'
        });
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update product'
        });
    }
});

// Create product
router.post('/products', async (req, res) => {
    try {
        const productData = req.body;
        
        // Generate slug from name
        if (productData.name && !productData.slug) {
            productData.slug = productData.name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');
            
            // Ensure unique slug
            const existing = await Product.findOne({ slug: productData.slug });
            if (existing) {
                productData.slug = `${productData.slug}-${Date.now()}`;
            }
        }

        productData.createdBy = req.user._id;

        const product = new Product(productData);
        await product.save();

        res.status(201).json({
            success: true,
            data: product,
            message: 'Product created successfully'
        });
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create product'
        });
    }
});

// Get all orders
router.get('/orders', async (req, res) => {
    try {
        const { page = 1, limit = 20, status, paymentStatus, search } = req.query;
        const skip = (page - 1) * limit;

        // Build filter
        const filter = {};
        if (status) filter.status = status;
        if (paymentStatus) filter.paymentStatus = paymentStatus;
        if (search) {
            filter.$or = [
                { orderNumber: { $regex: search, $options: 'i' } },
                { 'shippingAddress.email': { $regex: search, $options: 'i' } }
            ];
        }

        const [orders, total] = await Promise.all([
            Order.find(filter)
                .populate('user', 'firstName lastName email')
                .sort('-createdAt')
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            Order.countDocuments(filter)
        ]);

        const pages = Math.ceil(total / limit);

        res.json({
            success: true,
            data: orders,
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
        console.error('Error fetching orders:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch orders'
        });
    }
});

// Update order status
router.put('/orders/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const order = await Order.findById(id);
        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }

        order.status = status;
        
        // Update timestamps based on status
        if (status === 'delivered') {
            order.deliveredAt = new Date();
            order.shippingStatus = 'delivered';
        } else if (status === 'cancelled') {
            order.cancelledAt = new Date();
            order.shippingStatus = 'cancelled';
        }

        await order.save();

        res.json({
            success: true,
            data: order,
            message: 'Order status updated successfully'
        });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update order status'
        });
    }
});

// Get order by ID
router.get('/orders/:id', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('user', 'firstName lastName email phone')
            .populate('items.product', 'name brand images price')
            .lean();

        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }

        res.json({
            success: true,
            data: order
        });
    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch order'
        });
    }
});

module.exports = router;