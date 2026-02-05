// server.js - Complete Electronics Marketplace Backend with Analytics

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// Enhanced CORS configuration
app.use(cors({
    origin: function (origin, callback) {
        // Allow all origins in development
        const allowedOrigins = [
            'http://localhost:8000',
            'http://127.0.0.1:8000',
            'http://localhost:5000',
            'http://127.0.0.1:5000',
            'http://localhost:5500',
            'http://127.0.0.1:5500',
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:8080',
            'http://localhost:8080',
            'marketplace-smoky-six.vercel.app'
        ];
        
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log('Blocked by CORS:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

// Handle preflight requests
app.options('*', cors());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable for development
    crossOriginEmbedderPolicy: false
}));

// Logging
app.use(morgan('dev'));

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use(express.static(path.join(__dirname, '../')));

// Data storage directory
const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILES = {
    users: path.join(DATA_DIR, 'users.json'),
    products: path.join(DATA_DIR, 'products.json'),
    orders: path.join(DATA_DIR, 'orders.json'),
    categories: path.join(DATA_DIR, 'categories.json')
};

// Initialize data files
function initializeDataFiles() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    
    // Create empty files if they don't exist
    Object.values(DATA_FILES).forEach(filePath => {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify([]));
        }
    });
    
    // Seed initial data
    seedInitialData();
}

// Read data from JSON file
function readData(fileName) {
    try {
        const data = fs.readFileSync(DATA_FILES[fileName], 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading ${fileName}:`, error);
        return [];
    }
}

// Write data to JSON file
function writeData(fileName, data) {
    try {
        fs.writeFileSync(DATA_FILES[fileName], JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error(`Error writing ${fileName}:`, error);
        return false;
    }
}

// Generate unique ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Generate slug from name
function generateSlug(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// Seed initial data
function seedInitialData() {
    // Check if admin user exists
    const users = readData('users');
    const adminExists = users.find(user => user.email === 'admin@electroshop.com');
    
    if (!adminExists) {
        const hashedPassword = bcrypt.hashSync('Admin@123', 10);
        const adminUser = {
            _id: 'admin_' + generateId(),
            email: 'admin@electroshop.com',
            password: hashedPassword,
            firstName: 'Super',
            lastName: 'Admin',
            phone: '+1234567890',
            role: 'admin',
            isActive: true,
            emailVerified: true,
            avatar: '/images/avatar-default.png',
            wishlist: [],
            cart: [],
            orders: [],
            createdAt: new Date().toISOString(),
            lastLogin: null
        };
        users.push(adminUser);
        writeData('users', users);
        console.log('👑 Admin user created:', adminUser.email);
    }
    
    // Create a regular test user
    const testUserExists = users.find(user => user.email === 'test@example.com');
    if (!testUserExists) {
        const hashedPassword = bcrypt.hashSync('Test@123', 10);
        const testUser = {
            _id: 'user_' + generateId(),
            email: 'test@example.com',
            password: hashedPassword,
            firstName: 'Test',
            lastName: 'User',
            phone: '+1234567891',
            role: 'user',
            isActive: true,
            emailVerified: true,
            avatar: '/images/avatar-default.png',
            wishlist: [],
            cart: [],
            orders: [],
            createdAt: new Date().toISOString(),
            lastLogin: null
        };
        users.push(testUser);
        writeData('users', users);
        console.log('👤 Test user created:', testUser.email);
    }
    
    // Check if products exist
    const products = readData('products');
    if (products.length === 0) {
        const initialProducts = getInitialProducts();
        const adminUser = users.find(u => u.email === 'admin@electroshop.com');
        
        initialProducts.forEach(product => {
            product._id = generateId();
            product.createdBy = adminUser._id;
            product.createdAt = new Date().toISOString();
            product.updatedAt = new Date().toISOString();
            product.isActive = true;
            product.isInStock = product.stock > 0;
        });
        
        writeData('products', initialProducts);
        console.log(`📦 ${initialProducts.length} sample products created`);
    }
    
    // Seed categories
    const categories = readData('categories');
    if (categories.length === 0) {
        const initialCategories = [
            { _id: 'phones', name: 'Smartphones', icon: 'fas fa-mobile-alt', count: 156 },
            { _id: 'laptops', name: 'Laptops', icon: 'fas fa-laptop', count: 89 },
            { _id: 'tablets', name: 'Tablets', icon: 'fas fa-tablet-alt', count: 45 },
            { _id: 'computers', name: 'Computers', icon: 'fas fa-desktop', count: 67 },
            { _id: 'accessories', name: 'Accessories', icon: 'fas fa-headphones', count: 234 },
            { _id: 'other', name: 'Other Electronics', icon: 'fas fa-gamepad', count: 112 }
        ];
        writeData('categories', initialCategories);
        console.log('📊 Categories seeded');
    }
    
    // Seed initial orders if empty
    const orders = readData('orders');
    if (orders.length === 0) {
        const initialOrders = [
            {
                _id: 'order_' + generateId(),
                userId: 'user_' + generateId(),
                items: [
                    { productId: products[0]?._id, name: 'iPhone 14 Pro', price: 899, quantity: 1 },
                    { productId: products[3]?._id, name: 'AirPods Pro', price: 249, quantity: 1 }
                ],
                total: 1148,
                status: 'delivered',
                payment: { method: 'credit_card', status: 'completed' },
                shipping: { method: 'express', address: '123 Main St, City, Country' },
                createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                _id: 'order_' + generateId(),
                userId: 'user_' + generateId(),
                items: [
                    { productId: products[1]?._id, name: 'MacBook Pro 16"', price: 2499, quantity: 1 }
                ],
                total: 2499,
                status: 'shipped',
                payment: { method: 'paypal', status: 'completed' },
                shipping: { method: 'standard', address: '456 Oak Ave, Town, Country' },
                createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];
        writeData('orders', initialOrders);
        console.log('📦 Initial orders seeded');
    }
}

function getInitialProducts() {
    return [
        {
            name: 'iPhone 14 Pro',
            slug: 'iphone-14-pro',
            category: 'phones',
            brand: 'Apple',
            model: 'iPhone 14 Pro',
            description: 'Latest iPhone with Dynamic Island, A16 Bionic chip, and 48MP camera',
            shortDescription: 'Pro camera system, Emergency SOS, Dynamic Island',
            price: 999,
            discountPrice: 899,
            stock: 50,
            images: [
                { url: 'https://images.unsplash.com/photo-1663499482523-1c0c1eae0999?w=800&auto=format&fit=crop', alt: 'iPhone 14 Pro' }
            ],
            specifications: [
                { key: 'Display', value: '6.1-inch Super Retina XDR' },
                { key: 'Processor', value: 'A16 Bionic' },
                { key: 'RAM', value: '6GB' },
                { key: 'Storage', value: '128GB/256GB/512GB/1TB' },
                { key: 'Camera', value: '48MP Main + 12MP Ultra Wide + 12MP Telephoto' },
                { key: 'Battery', value: '3200 mAh' }
            ],
            features: ['5G', 'Face ID', 'Ceramic Shield', 'IP68 Water Resistance'],
            tags: ['apple', 'iphone', 'smartphone', 'premium'],
            isFeatured: true,
            rating: { average: 4.8, count: 250 },
            salesCount: 120,
            views: 1500
        },
        {
            name: 'MacBook Pro 16" M2',
            slug: 'macbook-pro-16-m2',
            category: 'laptops',
            brand: 'Apple',
            model: 'MacBook Pro 16"',
            description: 'Professional laptop with M2 Pro chip, Liquid Retina XDR display',
            shortDescription: 'M2 Pro chip, 16-inch Liquid Retina XDR, Pro performance',
            price: 2499,
            stock: 30,
            images: [
                { url: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop', alt: 'MacBook Pro 16"' }
            ],
            specifications: [
                { key: 'Display', value: '16.2-inch Liquid Retina XDR' },
                { key: 'Processor', value: 'Apple M2 Pro (12-core)' },
                { key: 'RAM', value: '16GB Unified Memory' },
                { key: 'Storage', value: '512GB SSD' },
                { key: 'Graphics', value: '19-core GPU' },
                { key: 'Battery', value: 'Up to 22 hours' }
            ],
            features: ['ProMotion', 'Six-speaker sound system', 'Magic Keyboard', 'Thunderbolt 4'],
            tags: ['apple', 'macbook', 'laptop', 'professional'],
            isFeatured: true,
            rating: { average: 4.9, count: 180 },
            salesCount: 85,
            views: 1200
        },
        {
            name: 'Samsung Galaxy S23 Ultra',
            slug: 'samsung-galaxy-s23-ultra',
            category: 'phones',
            brand: 'Samsung',
            model: 'Galaxy S23 Ultra',
            description: 'Premium Android smartphone with 200MP camera and S Pen',
            shortDescription: '200MP camera, S Pen included, Snapdragon 8 Gen 2',
            price: 1199,
            discountPrice: 1099,
            stock: 45,
            images: [
                { url: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=800&auto=format&fit=crop', alt: 'Samsung Galaxy S23 Ultra' }
            ],
            specifications: [
                { key: 'Display', value: '6.8-inch Dynamic AMOLED 2X' },
                { key: 'Processor', value: 'Snapdragon 8 Gen 2' },
                { key: 'RAM', value: '12GB' },
                { key: 'Storage', value: '256GB/512GB/1TB' },
                { key: 'Camera', value: '200MP Main + 12MP Ultra Wide + 10MP Telephoto x2' },
                { key: 'Battery', value: '5000 mAh' }
            ],
            features: ['S Pen', '100x Space Zoom', '8K Video', 'IP68', '5G'],
            tags: ['samsung', 'android', 'smartphone', 'camera'],
            isFeatured: true,
            rating: { average: 4.7, count: 320 },
            salesCount: 210,
            views: 1800
        },
        {
            name: 'AirPods Pro (2nd Gen)',
            slug: 'airpods-pro-2nd-gen',
            category: 'accessories',
            brand: 'Apple',
            model: 'AirPods Pro 2',
            description: 'Wireless earbuds with Active Noise Cancellation and Spatial Audio',
            shortDescription: 'Active Noise Cancellation, Adaptive Transparency, MagSafe Charging',
            price: 249,
            stock: 100,
            images: [
                { url: 'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?w=800&auto=format&fit=crop', alt: 'AirPods Pro 2' }
            ],
            specifications: [
                { key: 'Driver', value: 'Custom high-excursion Apple driver' },
                { key: 'ANC', value: 'Active Noise Cancellation' },
                { key: 'Battery Life', value: '6 hours (ANC on)' },
                { key: 'Case Battery', value: '30+ hours' },
                { key: 'Connectivity', value: 'Bluetooth 5.3' },
                { key: 'Charging', value: 'MagSafe, Qi, Lightning' }
            ],
            features: ['Personalized Spatial Audio', 'Adaptive EQ', 'Sweat & Water Resistant', 'Find My'],
            tags: ['apple', 'airpods', 'earbuds', 'wireless'],
            isFeatured: true,
            rating: { average: 4.8, count: 420 },
            salesCount: 350,
            views: 2500
        },
        {
            name: 'PlayStation 5',
            slug: 'playstation-5',
            category: 'other',
            brand: 'Sony',
            model: 'PS5 Console',
            description: 'Next-gen gaming console with ultra-high speed SSD and ray tracing',
            shortDescription: 'Ultra-high speed SSD, ray tracing, 4K/120fps gaming',
            price: 499,
            stock: 20,
            images: [
                { url: 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=800&auto=format&fit=crop', alt: 'PlayStation 5' }
            ],
            specifications: [
                { key: 'CPU', value: 'AMD Ryzen Zen 2, 8-core' },
                { key: 'GPU', value: 'AMD RDNA 2, 10.28 TFLOPs' },
                { key: 'RAM', value: '16GB GDDR6' },
                { key: 'Storage', value: '825GB Custom SSD' },
                { key: 'Output', value: '4K 120Hz, 8K' },
                { key: 'Optical Drive', value: '4K UHD Blu-ray' }
            ],
            features: ['3D Audio', 'DualSense Controller', 'Backward Compatibility', 'PS5 Game Boost'],
            tags: ['sony', 'gaming', 'console', 'playstation'],
            isFeatured: true,
            rating: { average: 4.9, count: 580 },
            salesCount: 450,
            views: 3200
        }
    ];
}

// Initialize data files on startup
initializeDataFiles();

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'electroshop-secret-key-2024-admin-super-secure';

// ==================== AUTH ROUTES ====================

// Register user
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, firstName, lastName, phone } = req.body;

        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({
                success: false,
                error: 'Please provide all required fields'
            });
        }

        const users = readData('users');
        const existingUser = users.find(user => user.email === email);
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'User already exists with this email'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            _id: 'user_' + generateId(),
            email,
            password: hashedPassword,
            firstName,
            lastName,
            phone,
            role: 'user',
            isActive: true,
            emailVerified: false,
            avatar: '/images/avatar-default.png',
            wishlist: [],
            cart: [],
            orders: [],
            address: {},
            createdAt: new Date().toISOString(),
            lastLogin: null
        };

        users.push(newUser);
        writeData('users', users);

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: newUser._id,
                email: newUser.email,
                role: newUser.role 
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Remove password from response
        const { password: _, ...userWithoutPassword } = newUser;

        res.status(201).json({
            success: true,
            data: {
                user: userWithoutPassword,
                token
            },
            message: 'Registration successful'
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            error: 'Registration failed. Please try again.'
        });
    }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Please provide email and password'
            });
        }

        const users = readData('users');
        const user = users.find(user => user.email === email);
        
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                error: 'Account is disabled'
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Update last login
        user.lastLogin = new Date().toISOString();
        writeData('users', users);

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: user._id,
                email: user.email,
                role: user.role 
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Remove password from response
        const { password: _, ...userWithoutPassword } = user;

        res.json({
            success: true,
            data: {
                user: userWithoutPassword,
                token
            },
            message: 'Login successful'
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Login failed. Please try again.'
        });
    }
});

// Get current user
app.get('/api/auth/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({
                success: false,
                error: 'No token provided'
            });
        }

        const token = authHeader.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'No token provided'
            });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        
        const users = readData('users');
        const user = users.find(user => user._id === decoded.userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Remove password from response
        const { password, ...userWithoutPassword } = user;

        res.json({
            success: true,
            data: userWithoutPassword
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(401).json({
            success: false,
            error: 'Invalid or expired token'
        });
    }
});

// ==================== PRODUCT ROUTES ====================

// Get all products with filters
app.get('/api/products', async (req, res) => {
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

        let products = readData('products').filter(p => p.isActive !== false);

        // Apply filters
        if (category) {
            products = products.filter(p => p.category === category);
        }
        if (brand) {
            products = products.filter(p => p.brand === brand);
        }
        if (featured === 'true') {
            products = products.filter(p => p.isFeatured === true);
        }
        if (minPrice) {
            products = products.filter(p => p.price >= Number(minPrice));
        }
        if (maxPrice) {
            products = products.filter(p => p.price <= Number(maxPrice));
        }
        if (search) {
            const searchLower = search.toLowerCase();
            products = products.filter(p => 
                p.name.toLowerCase().includes(searchLower) ||
                (p.description && p.description.toLowerCase().includes(searchLower)) ||
                p.brand.toLowerCase().includes(searchLower) ||
                p.category.toLowerCase().includes(searchLower)
            );
        }

        // Apply sorting
        if (sort === 'price_asc') {
            products.sort((a, b) => (a.discountPrice || a.price) - (b.discountPrice || b.price));
        } else if (sort === 'price_desc') {
            products.sort((a, b) => (b.discountPrice || b.price) - (a.discountPrice || a.price));
        } else if (sort === 'name') {
            products.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sort === 'newest') {
            products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } else if (sort === 'popular') {
            products.sort((a, b) => (b.rating?.average || 0) - (a.rating?.average || 0));
        } else {
            products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }

        // Pagination
        const pageNum = Number(page);
        const limitNum = Number(limit);
        const startIndex = (pageNum - 1) * limitNum;
        const endIndex = startIndex + limitNum;
        const paginatedProducts = products.slice(startIndex, endIndex);

        res.json({
            success: true,
            data: paginatedProducts,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: products.length,
                pages: Math.ceil(products.length / limitNum),
                hasNext: endIndex < products.length,
                hasPrev: startIndex > 0
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
app.get('/api/products/:id', async (req, res) => {
    try {
        const products = readData('products');
        const product = products.find(p => p._id === req.params.id);
        
        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        // Increment view count
        product.views = (product.views || 0) + 1;
        writeData('products', products);

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
app.get('/api/products/featured/random', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 8;
        let products = readData('products');
        
        // Filter featured and active products
        products = products.filter(p => p.isFeatured && p.isActive !== false);
        
        // Shuffle and get random products
        const shuffled = products.sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, limit);

        res.json({
            success: true,
            data: selected
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
app.get('/api/products/category/:category', async (req, res) => {
    try {
        const { category } = req.params;
        const { page = 1, limit = 12, sort = 'createdAt' } = req.query;
        
        let products = readData('products').filter(p => p.category === category && p.isActive !== false);

        // Apply sorting
        if (sort === 'price_asc') {
            products.sort((a, b) => (a.discountPrice || a.price) - (b.discountPrice || b.price));
        } else if (sort === 'price_desc') {
            products.sort((a, b) => (b.discountPrice || b.price) - (a.discountPrice || a.price));
        } else if (sort === 'name') {
            products.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sort === 'newest') {
            products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } else {
            products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }

        // Pagination
        const pageNum = Number(page);
        const limitNum = Number(limit);
        const startIndex = (pageNum - 1) * limitNum;
        const endIndex = startIndex + limitNum;
        const paginatedProducts = products.slice(startIndex, endIndex);

        res.json({
            success: true,
            data: paginatedProducts,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: products.length,
                pages: Math.ceil(products.length / limitNum),
                hasNext: endIndex < products.length,
                hasPrev: startIndex > 0
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

// ==================== ADMIN MIDDLEWARE ====================

// Admin middleware
function verifyAdmin(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({
                success: false,
                error: 'No token provided'
            });
        }

        const token = authHeader.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'No token provided'
            });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        
        const users = readData('users');
        const user = users.find(user => user._id === decoded.userId);
        
        if (!user || user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Admin access required'
            });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Admin middleware error:', error);
        res.status(401).json({
            success: false,
            error: 'Authentication failed'
        });
    }
}

// ==================== ENHANCED ANALYTICS ENDPOINTS ====================

// Get comprehensive analytics dashboard data
app.get('/api/admin/analytics/dashboard', verifyAdmin, async (req, res) => {
    try {
        const { startDate, endDate, period = 'monthly' } = req.query;
        
        const products = readData('products');
        const orders = readData('orders');
        const users = readData('users');
        
        // Calculate date range
        const now = new Date();
        const defaultEnd = new Date(now);
        const defaultStart = new Date(now);
        
        if (period === 'today') {
            defaultStart.setHours(0, 0, 0, 0);
        } else if (period === 'week') {
            defaultStart.setDate(defaultStart.getDate() - 7);
        } else if (period === 'month') {
            defaultStart.setMonth(defaultStart.getMonth() - 1);
        } else if (period === 'quarter') {
            defaultStart.setMonth(defaultStart.getMonth() - 3);
        } else if (period === 'year') {
            defaultStart.setFullYear(defaultStart.getFullYear() - 1);
        }
        
        const start = startDate ? new Date(startDate) : defaultStart;
        const end = endDate ? new Date(endDate) : defaultEnd;
        
        // KPI Calculations
        const kpis = {
            totalRevenue: calculateTotalRevenue(orders, start, end),
            totalOrders: calculateTotalOrders(orders, start, end),
            avgOrderValue: calculateAverageOrderValue(orders, start, end),
            activeCustomers: calculateActiveCustomers(users, start, end),
            cartAbandonment: 68.3, // Mock - would calculate from abandoned carts
            conversionRate: 3.2, // Mock - would calculate from sessions
            newCustomers: calculateNewCustomers(users, start, end),
            returningRate: 42 // Mock - percentage
        };
        
        // Generate trend data
        const trendData = generateTrendData(orders, products, users, period, start, end);
        
        // Regional performance (mock data - would be from orders with addresses)
        const regionalData = generateRegionalData();
        
        // Variable correlation (mock data)
        const correlationData = generateCorrelationData();
        
        // Customer segmentation
        const segmentationData = generateSegmentationData(users, orders);
        
        // Forecast data
        const forecastData = generateForecastData(orders, period);
        
        // Budget vs actual
        const budgetData = generateBudgetData(products, orders);
        
        // Top products
        const topProducts = getTopProducts(products, orders, start, end, 10);
        
        // Recent activity
        const recentActivity = getRecentActivity(orders, users, 10);
        
        // Inventory alerts
        const lowStockProducts = getLowStockProducts(products);
        
        res.json({
            success: true,
            data: {
                kpis,
                trend: trendData,
                regional: regionalData,
                correlation: correlationData,
                segmentation: segmentationData,
                forecast: forecastData,
                budget: budgetData,
                topProducts,
                recentActivity,
                alerts: {
                    lowStock: lowStockProducts.length,
                    outOfStock: products.filter(p => p.stock <= 0).length,
                    pendingOrders: orders.filter(o => o.status === 'pending').length
                }
            },
            meta: {
                period,
                startDate: start.toISOString(),
                endDate: end.toISOString(),
                generatedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error fetching analytics dashboard:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch analytics data'
        });
    }
});

// Helper functions for analytics
function calculateTotalRevenue(orders, start, end) {
    return orders
        .filter(order => {
            const orderDate = new Date(order.createdAt || order.date);
            return orderDate >= start && orderDate <= end && order.status === 'delivered';
        })
        .reduce((sum, order) => sum + (order.total || 0), 0);
}

function calculateTotalOrders(orders, start, end) {
    return orders.filter(order => {
        const orderDate = new Date(order.createdAt || order.date);
        return orderDate >= start && orderDate <= end;
    }).length;
}

function calculateAverageOrderValue(orders, start, end) {
    const filteredOrders = orders.filter(order => {
        const orderDate = new Date(order.createdAt || order.date);
        return orderDate >= start && orderDate <= end && order.status === 'delivered';
    });
    
    if (filteredOrders.length === 0) return 0;
    
    const total = filteredOrders.reduce((sum, order) => sum + (order.total || 0), 0);
    return total / filteredOrders.length;
}

function calculateActiveCustomers(users, start, end) {
    return users.filter(user => {
        if (!user.lastLogin) return false;
        const lastLogin = new Date(user.lastLogin);
        return lastLogin >= start && lastLogin <= end;
    }).length;
}

function calculateNewCustomers(users, start, end) {
    return users.filter(user => {
        const createdAt = new Date(user.createdAt);
        return createdAt >= start && createdAt <= end;
    }).length;
}

function generateTrendData(orders, products, users, period, start, end) {
    const dataPoints = period === 'daily' ? 30 : period === 'weekly' ? 12 : period === 'monthly' ? 12 : 4;
    
    const labels = [];
    const revenueData = [];
    const orderData = [];
    const customerData = [];
    
    for (let i = dataPoints - 1; i >= 0; i--) {
        const pointStart = new Date(start);
        const pointEnd = new Date(start);
        
        if (period === 'daily') {
            pointStart.setDate(pointStart.getDate() + i);
            pointEnd.setDate(pointEnd.getDate() + i + 1);
            labels.push(pointStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        } else if (period === 'weekly') {
            pointStart.setDate(pointStart.getDate() + i * 7);
            pointEnd.setDate(pointEnd.getDate() + (i + 1) * 7);
            labels.push(`Week ${Math.floor(i / 4) + 1}`);
        } else if (period === 'monthly') {
            pointStart.setMonth(pointStart.getMonth() + i);
            pointEnd.setMonth(pointEnd.getMonth() + i + 1);
            labels.push(pointStart.toLocaleDateString('en-US', { month: 'short' }));
        } else {
            pointStart.setMonth(pointStart.getMonth() + i * 3);
            pointEnd.setMonth(pointEnd.getMonth() + (i + 1) * 3);
            labels.push(`Q${Math.floor(i % 4) + 1}`);
        }
        
        // Calculate metrics for this period
        const periodRevenue = calculateTotalRevenue(orders, pointStart, pointEnd);
        const periodOrders = calculateTotalOrders(orders, pointStart, pointEnd);
        const periodCustomers = calculateNewCustomers(users, pointStart, pointEnd);
        
        revenueData.push(periodRevenue);
        orderData.push(periodOrders);
        customerData.push(periodCustomers);
    }
    
    return {
        labels,
        datasets: [
            {
                name: 'Revenue',
                data: revenueData,
                color: '#3b82f6'
            },
            {
                name: 'Orders',
                data: orderData,
                color: '#10b981'
            },
            {
                name: 'New Customers',
                data: customerData,
                color: '#8b5cf6'
            }
        ]
    };
}

function generateRegionalData() {
    return {
        regions: [
            { name: 'North America', revenue: 85000, orders: 450, growth: 12.5 },
            { name: 'Europe', revenue: 62000, orders: 320, growth: 8.3 },
            { name: 'Asia Pacific', revenue: 45000, orders: 280, growth: 15.7 },
            { name: 'South America', revenue: 22000, orders: 140, growth: 6.8 },
            { name: 'Middle East & Africa', revenue: 18000, orders: 95, growth: 11.2 }
        ],
        topCountries: [
            { country: 'United States', revenue: 45000, orders: 250 },
            { country: 'United Kingdom', revenue: 28000, orders: 150 },
            { country: 'Germany', revenue: 22000, orders: 120 },
            { country: 'Japan', revenue: 19000, orders: 110 },
            { country: 'Australia', revenue: 16000, orders: 85 }
        ]
    };
}

function generateCorrelationData() {
    return {
        variables: ['Customer Spend', 'Engagement Rate', 'Cart Abandonment', 'Churn Rate', 'Marketing Spend'],
        matrix: [
            [1.0, 0.8, -0.6, -0.7, 0.9],
            [0.8, 1.0, -0.5, -0.6, 0.7],
            [-0.6, -0.5, 1.0, 0.8, -0.4],
            [-0.7, -0.6, 0.8, 1.0, -0.5],
            [0.9, 0.7, -0.4, -0.5, 1.0]
        ]
    };
}

function generateSegmentationData(users, orders) {
    const segments = [
        { name: 'High Value', color: '#3b82f6', size: 0.15 },
        { name: 'Medium Value', color: '#10b981', size: 0.25 },
        { name: 'Low Value', color: '#f59e0b', size: 0.35 },
        { name: 'New Customers', color: '#8b5cf6', size: 0.10 },
        { name: 'At Risk', color: '#ef4444', size: 0.08 },
        { name: 'Dormant', color: '#9ca3af', size: 0.07 }
    ];
    
    return segments.map(segment => ({
        ...segment,
        count: Math.floor(users.length * segment.size),
        avgOrderValue: Math.floor(Math.random() * 500) + 50,
        frequency: Math.floor(Math.random() * 10) + 1
    }));
}

function generateForecastData(orders, period) {
    const historical = [];
    const forecast = [];
    const confidenceUpper = [];
    const confidenceLower = [];
    
    // Generate historical data (past 6 periods)
    for (let i = 6; i > 0; i--) {
        const base = 20000;
        const variation = Math.random() * 5000;
        historical.push(base + variation);
    }
    
    // Generate forecast (next 3 periods)
    const lastValue = historical[historical.length - 1];
    for (let i = 1; i <= 3; i++) {
        const growth = 1 + (Math.random() * 0.1); // 0-10% growth
        const forecastValue = lastValue * Math.pow(growth, i);
        forecast.push(forecastValue);
        confidenceUpper.push(forecastValue * 1.1); // +10%
        confidenceLower.push(forecastValue * 0.9); // -10%
    }
    
    return {
        historical,
        forecast,
        confidenceUpper,
        confidenceLower,
        metrics: {
            rSquared: 0.94,
            mape: 6.8,
            confidence: 92.4,
            nextPeriodGrowth: '+12.5%'
        }
    };
}

function generateBudgetData(products, orders) {
    const categories = ['Phones', 'Laptops', 'Tablets', 'Accessories', 'Gaming'];
    
    return categories.map(category => {
        const budget = Math.floor(Math.random() * 100000) + 50000;
        const actual = budget * (0.8 + Math.random() * 0.4); // 80-120% of budget
        const variance = actual - budget;
        
        return {
            category,
            budget,
            actual,
            variance,
            variancePercent: ((variance / budget) * 100).toFixed(1)
        };
    });
}

function getTopProducts(products, orders, start, end, limit = 10) {
    return products
        .slice(0, limit)
        .map((product, index) => ({
            id: product._id,
            name: product.name,
            category: product.category,
            sales: Math.floor(Math.random() * 100) + 50,
            revenue: Math.floor(Math.random() * 10000) + 5000,
            growth: (Math.random() * 30) + 5,
            stock: product.stock,
            rating: product.rating?.average || 4.5
        }))
        .sort((a, b) => b.revenue - a.revenue);
}

function getRecentActivity(orders, users, limit = 10) {
    return orders
        .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))
        .slice(0, limit)
        .map(order => {
            const user = users.find(u => u._id === order.userId) || {};
            return {
                id: order._id || order.id,
                type: 'order',
                user: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Anonymous',
                description: `Placed order for ${order.items?.length || 0} items`,
                amount: order.total,
                status: order.status,
                timestamp: order.createdAt || order.date
            };
        });
}

function getLowStockProducts(products) {
    return products
        .filter(p => p.stock > 0 && p.stock < 10)
        .map(p => ({
            id: p._id,
            name: p.name,
            stock: p.stock,
            category: p.category,
            threshold: 10
        }));
}

// ==================== ENHANCED ADMIN DASHBOARD ====================

// Admin dashboard stats
app.get('/api/admin/dashboard/stats', verifyAdmin, async (req, res) => {
    try {
        const users = readData('users');
        const products = readData('products');
        const orders = readData('orders');

        // Recent orders
        const recentOrders = orders
            .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))
            .slice(0, 5)
            .map(order => ({
                id: order._id || `ORD-${Date.now()}`,
                customer: order.customer || 'Customer',
                date: order.createdAt || order.date,
                items: order.items?.length || 0,
                total: order.total || 0,
                status: order.status || 'pending'
            }));

        // Top products
        const topProducts = products
            .filter(p => p.salesCount > 0)
            .sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0))
            .slice(0, 5)
            .map(p => ({
                name: p.name,
                sales: p.salesCount || 0,
                revenue: (p.salesCount || 0) * (p.discountPrice || p.price)
            }));

        // Calculate stats
        const totalRevenue = orders
            .filter(o => o.status === 'delivered')
            .reduce((sum, order) => sum + (order.total || 0), 0);
        
        const newUsersToday = users.filter(u => {
            const created = new Date(u.createdAt);
            const today = new Date();
            return created.toDateString() === today.toDateString();
        }).length;

        const lowStockProducts = products.filter(p => p.stock < 10 && p.stock > 0).length;
        const outOfStockProducts = products.filter(p => p.stock <= 0).length;
        const pendingOrders = orders.filter(o => o.status === 'pending').length;
        
        // Monthly revenue
        const today = new Date();
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthRevenue = orders
            .filter(o => {
                const orderDate = new Date(o.createdAt || o.date);
                return orderDate >= monthStart && o.status === 'delivered';
            })
            .reduce((sum, order) => sum + (order.total || 0), 0);
        
        const avgOrderValue = orders.length > 0 ? 
            totalRevenue / orders.filter(o => o.status === 'delivered').length : 0;

        res.json({
            success: true,
            data: {
                overview: {
                    totalUsers: users.length,
                    newUsersToday,
                    totalProducts: products.length,
                    totalOrders: orders.length,
                    totalRevenue,
                    monthRevenue,
                    avgOrderValue: avgOrderValue.toFixed(2),
                    lowStockProducts,
                    outOfStockProducts,
                    pendingOrders
                },
                recentOrders,
                topProducts,
                analytics: {
                    revenueTrend: getRevenueTrend(orders, 30),
                    categoryDistribution: getCategoryDistribution(products),
                    userGrowth: getUserGrowth(users, 30)
                }
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

// Helper function for revenue trend
function getRevenueTrend(orders, days) {
    const trend = [];
    const now = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);
        
        const dailyRevenue = orders
            .filter(o => {
                const orderDate = new Date(o.createdAt || o.date);
                return orderDate >= date && orderDate < nextDay && o.status === 'delivered';
            })
            .reduce((sum, order) => sum + (order.total || 0), 0);
        
        trend.push({
            date: date.toISOString().split('T')[0],
            revenue: dailyRevenue
        });
    }
    
    return trend;
}

// Helper function for category distribution
function getCategoryDistribution(products) {
    const distribution = {};
    products.forEach(product => {
        distribution[product.category] = (distribution[product.category] || 0) + 1;
    });
    
    return Object.entries(distribution).map(([category, count]) => ({
        category,
        count,
        percentage: (count / products.length * 100).toFixed(1)
    }));
}

// Helper function for user growth
function getUserGrowth(users, days) {
    const growth = [];
    const now = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);
        
        const dailyUsers = users.filter(u => {
            const created = new Date(u.createdAt);
            return created >= date && created < nextDay;
        }).length;
        
        growth.push({
            date: date.toISOString().split('T')[0],
            users: dailyUsers,
            cumulative: users.filter(u => {
                const created = new Date(u.createdAt);
                return created < nextDay;
            }).length
        });
    }
    
    return growth;
}

// ==================== ADMIN USER MANAGEMENT ====================

// Admin get all users
app.get('/api/admin/users', verifyAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, search, role } = req.query;
        
        let users = readData('users');
        
        // Apply filters
        if (role) {
            users = users.filter(user => user.role === role);
        }
        if (search) {
            const searchLower = search.toLowerCase();
            users = users.filter(user => 
                user.email.toLowerCase().includes(searchLower) ||
                user.firstName.toLowerCase().includes(searchLower) ||
                user.lastName.toLowerCase().includes(searchLower)
            );
        }

        // Remove passwords
        users = users.map(({ password, ...user }) => user);

        // Sort by creation date
        users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Pagination
        const pageNum = Number(page);
        const limitNum = Number(limit);
        const startIndex = (pageNum - 1) * limitNum;
        const endIndex = startIndex + limitNum;
        const paginatedUsers = users.slice(startIndex, endIndex);

        res.json({
            success: true,
            data: paginatedUsers,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: users.length,
                pages: Math.ceil(users.length / limitNum),
                hasNext: endIndex < users.length,
                hasPrev: startIndex > 0
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

// Admin update user
app.put('/api/admin/users/:id', verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { firstName, lastName, phone, address, role, isActive } = req.body;
        
        let users = readData('users');
        const userIndex = users.findIndex(user => user._id === id);
        
        if (userIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Update fields
        if (firstName !== undefined) users[userIndex].firstName = firstName;
        if (lastName !== undefined) users[userIndex].lastName = lastName;
        if (phone !== undefined) users[userIndex].phone = phone;
        if (address !== undefined) users[userIndex].address = address;
        if (role !== undefined) users[userIndex].role = role;
        if (isActive !== undefined) users[userIndex].isActive = isActive;

        writeData('users', users);

        // Remove password from response
        const { password, ...userWithoutPassword } = users[userIndex];

        res.json({
            success: true,
            data: userWithoutPassword,
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

// ==================== ADMIN PRODUCT MANAGEMENT ====================

// Admin get all products
app.get('/api/admin/products', verifyAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, search, category, isActive } = req.query;
        
        let products = readData('products');
        
        // Apply filters
        if (category) {
            products = products.filter(p => p.category === category);
        }
        if (isActive !== undefined) {
            products = products.filter(p => p.isActive === (isActive === 'true'));
        }
        if (search) {
            const searchLower = search.toLowerCase();
            products = products.filter(p => 
                p.name.toLowerCase().includes(searchLower) ||
                p.brand.toLowerCase().includes(searchLower) ||
                (p.model && p.model.toLowerCase().includes(searchLower))
            );
        }

        // Sort by creation date
        products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Pagination
        const pageNum = Number(page);
        const limitNum = Number(limit);
        const startIndex = (pageNum - 1) * limitNum;
        const endIndex = startIndex + limitNum;
        const paginatedProducts = products.slice(startIndex, endIndex);

        res.json({
            success: true,
            data: paginatedProducts,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: products.length,
                pages: Math.ceil(products.length / limitNum),
                hasNext: endIndex < products.length,
                hasPrev: startIndex > 0
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

// Admin create product
app.post('/api/admin/products', verifyAdmin, async (req, res) => {
    try {
        const productData = req.body;
        
        // Generate slug from name
        if (productData.name && !productData.slug) {
            productData.slug = generateSlug(productData.name);
            
            // Ensure unique slug
            let products = readData('products');
            const existing = products.find(p => p.slug === productData.slug);
            if (existing) {
                productData.slug = `${productData.slug}-${Date.now()}`;
            }
        }

        productData._id = generateId();
        productData.createdAt = new Date().toISOString();
        productData.updatedAt = new Date().toISOString();
        productData.createdBy = req.user._id;
        productData.isActive = productData.isActive !== undefined ? productData.isActive : true;
        productData.isInStock = productData.stock > 0;
        productData.rating = productData.rating || { average: 0, count: 0 };
        productData.salesCount = productData.salesCount || 0;
        productData.views = productData.views || 0;

        let products = readData('products');
        products.push(productData);
        writeData('products', products);

        res.status(201).json({
            success: true,
            data: productData,
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

// Admin update product
app.put('/api/admin/products/:id', verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        let products = readData('products');
        const productIndex = products.findIndex(p => p._id === id);
        
        if (productIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        // Update fields
        Object.keys(updates).forEach(key => {
            if (updates[key] !== undefined) {
                products[productIndex][key] = updates[key];
            }
        });

        // Update timestamps
        products[productIndex].updatedAt = new Date().toISOString();
        
        // Update stock status
        if (updates.stock !== undefined) {
            products[productIndex].isInStock = updates.stock > 0;
        }

        writeData('products', products);

        res.json({
            success: true,
            data: products[productIndex],
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

// ==================== ENHANCED PRODUCT MANAGEMENT ====================

// Bulk delete products
app.delete('/api/admin/products/bulk', verifyAdmin, async (req, res) => {
    try {
        const { productIds, deleteImages = false } = req.body;
        
        if (!Array.isArray(productIds) || productIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Product IDs array is required'
            });
        }
        
        let products = readData('products');
        const originalLength = products.length;
        
        // Filter out products to delete
        products = products.filter(product => !productIds.includes(product._id));
        
        writeData('products', products);
        
        const deletedCount = originalLength - products.length;
        
        res.json({
            success: true,
            data: {
                deleted: deletedCount,
                remaining: products.length
            },
            message: `Successfully deleted ${deletedCount} products`
        });
    } catch (error) {
        console.error('Error in bulk product deletion:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete products'
        });
    }
});

// Bulk product upload via CSV
app.post('/api/admin/products/bulk', verifyAdmin, async (req, res) => {
    try {
        const productsData = req.body.products;
        
        if (!Array.isArray(productsData)) {
            return res.status(400).json({
                success: false,
                error: 'Products array is required'
            });
        }
        
        let existingProducts = readData('products');
        let newProducts = [];
        let updatedProducts = 0;
        let createdProducts = 0;
        let errors = [];
        
        for (const productData of productsData) {
            try {
                // Validate required fields
                if (!productData.name || !productData.category || !productData.price || productData.stock === undefined) {
                    errors.push({
                        product: productData.name || 'Unknown',
                        error: 'Missing required fields',
                        data: productData
                    });
                    continue;
                }
                
                // Check if product exists (by SKU or name)
                const existingIndex = existingProducts.findIndex(p => 
                    p.sku === productData.sku || 
                    p.name.toLowerCase() === productData.name.toLowerCase()
                );
                
                if (existingIndex !== -1) {
                    // Update existing product
                    Object.keys(productData).forEach(key => {
                        if (productData[key] !== undefined) {
                            existingProducts[existingIndex][key] = productData[key];
                        }
                    });
                    
                    existingProducts[existingIndex].updatedAt = new Date().toISOString();
                    updatedProducts++;
                } else {
                    // Create new product
                    const newProduct = {
                        _id: generateId(),
                        ...productData,
                        slug: productData.slug || generateSlug(productData.name),
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        createdBy: req.user._id,
                        isActive: productData.isActive !== undefined ? productData.isActive : true,
                        isInStock: productData.stock > 0,
                        rating: productData.rating || { average: 0, count: 0 },
                        salesCount: productData.salesCount || 0,
                        views: productData.views || 0
                    };
                    
                    existingProducts.push(newProduct);
                    createdProducts++;
                    newProducts.push(newProduct);
                }
            } catch (error) {
                errors.push({
                    product: productData.name || 'Unknown',
                    error: error.message,
                    data: productData
                });
            }
        }
        
        writeData('products', existingProducts);
        
        res.status(201).json({
            success: true,
            data: {
                totalProcessed: productsData.length,
                created: createdProducts,
                updated: updatedProducts,
                errors: errors.length,
                newProducts: newProducts.map(p => ({ id: p._id, name: p.name })),
                errorDetails: errors
            },
            message: `Bulk upload completed: ${createdProducts} created, ${updatedProducts} updated`
        });
    } catch (error) {
        console.error('Error in bulk product upload:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to upload products in bulk'
        });
    }
});

// Get product with full details
app.get('/api/admin/products/:id/details', verifyAdmin, async (req, res) => {
    try {
        const products = readData('products');
        const product = products.find(p => p._id === req.params.id);
        
        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }
        
        // Get product analytics
        const orders = readData('orders');
        const productOrders = orders.filter(order => 
            order.items?.some(item => item.productId === req.params.id)
        );
        
        const productAnalytics = {
            totalSales: productOrders.length,
            totalRevenue: productOrders.reduce((sum, order) => {
                const item = order.items.find(i => i.productId === req.params.id);
                return sum + (item ? item.price * item.quantity : 0);
            }, 0),
            avgRating: product.rating?.average || 0,
            reviewCount: product.rating?.count || 0,
            monthlySales: getMonthlySales(productOrders, req.params.id),
            customerDemographics: getCustomerDemographics(productOrders, readData('users'))
        };
        
        res.json({
            success: true,
            data: {
                product,
                analytics: productAnalytics,
                inventory: {
                    currentStock: product.stock,
                    lowStockThreshold: 10,
                    reorderPoint: 5,
                    stockHistory: getStockHistory(product)
                }
            }
        });
    } catch (error) {
        console.error('Error fetching product details:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch product details'
        });
    }
});

// Get monthly sales for a product
function getMonthlySales(productOrders, productId) {
    const monthly = {};
    productOrders.forEach(order => {
        const date = new Date(order.createdAt || order.date);
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthly[monthYear]) {
            monthly[monthYear] = {
                sales: 0,
                revenue: 0,
                orders: 0
            };
        }
        
        const item = order.items.find(i => i.productId === productId);
        if (item) {
            monthly[monthYear].sales += item.quantity;
            monthly[monthYear].revenue += item.price * item.quantity;
            monthly[monthYear].orders++;
        }
    });
    
    return Object.entries(monthly).map(([month, data]) => ({
        month,
        ...data
    }));
}

// Get customer demographics for product
function getCustomerDemographics(productOrders, users) {
    const demographics = {
        ageGroups: { '18-24': 0, '25-34': 0, '35-44': 0, '45-54': 0, '55+': 0 },
        regions: {},
        repeatCustomers: 0
    };
    
    const customerIds = new Set();
    
    productOrders.forEach(order => {
        if (order.userId) {
            customerIds.add(order.userId);
            const user = users.find(u => u._id === order.userId);
            
            if (user) {
                // Region (simplified - would use address in production)
                const region = user.address?.country || 'Unknown';
                demographics.regions[region] = (demographics.regions[region] || 0) + 1;
            }
        }
    });
    
    // Count orders per customer to find repeat customers
    const customerOrderCount = {};
    productOrders.forEach(order => {
        if (order.userId) {
            customerOrderCount[order.userId] = (customerOrderCount[order.userId] || 0) + 1;
        }
    });
    
    demographics.repeatCustomers = Object.values(customerOrderCount).filter(count => count > 1).length;
    
    return demographics;
}

// Get stock history for a product
function getStockHistory(product) {
    // Mock stock history
    return [
        { date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), stock: 100, change: -50, reason: 'Initial stock' },
        { date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(), stock: 75, change: -25, reason: 'Sales' },
        { date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), stock: 50, change: -25, reason: 'Sales' },
        { date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), stock: 80, change: 30, reason: 'Restock' },
        { date: new Date().toISOString(), stock: product.stock, change: 0, reason: 'Current' }
    ];
}

// Download product template CSV
app.get('/api/admin/products/template', verifyAdmin, async (req, res) => {
    try {
        const template = `Name,Category,Brand,Model,Description,Price,Discount Price,Stock,SKU,Status,Featured
iPhone 15 Pro,phones,Apple,iPhone 15 Pro,"Latest iPhone with advanced camera",999,899,50,APPLE-IP15-PRO,active,true
MacBook Pro 16",laptops,Apple,MacBook Pro 16","Professional laptop with M3 chip",2499,,25,APPLE-MBP-16,active,true
Samsung Galaxy S24,phones,Samsung,Galaxy S24,"Premium Android smartphone",799,749,30,SAMSUNG-GS24,active,true
Sony WH-1000XM5,accessories,Sony,WH-1000XM5,"Noise cancelling headphones",349,299,45,SONY-WH1000XM5,active,true`;
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=product-template.csv');
        res.send(template);
    } catch (error) {
        console.error('Error generating template:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate template'
        });
    }
});

// ==================== CATEGORY ROUTES ====================

// Get all categories
app.get('/api/categories', async (req, res) => {
    try {
        const categories = readData('categories');
        res.json({
            success: true,
            data: categories
        });
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch categories'
        });
    }
});

// ==================== ORDER ANALYTICS ====================

// Get order analytics
app.get('/api/admin/analytics/orders', verifyAdmin, async (req, res) => {
    try {
        const { startDate, endDate, groupBy = 'day' } = req.query;
        
        const orders = readData('orders');
        const products = readData('products');
        
        // Filter orders by date
        const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();
        
        const filteredOrders = orders.filter(order => {
            const orderDate = new Date(order.createdAt || order.date);
            return orderDate >= start && orderDate <= end;
        });
        
        // Group orders
        const groupedData = groupOrdersByDate(filteredOrders, groupBy);
        
        // Calculate metrics
        const metrics = {
            totalOrders: filteredOrders.length,
            totalRevenue: filteredOrders.reduce((sum, order) => sum + (order.total || 0), 0),
            avgOrderValue: filteredOrders.length > 0 ? 
                filteredOrders.reduce((sum, order) => sum + (order.total || 0), 0) / filteredOrders.length : 0,
            orderStatusDistribution: getOrderStatusDistribution(filteredOrders),
            topProducts: getTopProductsFromOrders(filteredOrders, products, 10),
            salesByHour: getSalesByHour(filteredOrders),
            paymentMethodDistribution: getPaymentMethodDistribution(filteredOrders),
            shippingMethodDistribution: getShippingMethodDistribution(filteredOrders)
        };
        
        res.json({
            success: true,
            data: {
                groupedData,
                metrics,
                orders: filteredOrders.slice(0, 50)
            },
            meta: {
                startDate: start.toISOString(),
                endDate: end.toISOString(),
                groupBy,
                totalOrders: filteredOrders.length
            }
        });
    } catch (error) {
        console.error('Error fetching order analytics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch order analytics'
        });
    }
});

// Helper functions for order analytics
function groupOrdersByDate(orders, groupBy) {
    const groups = {};
    
    orders.forEach(order => {
        const date = new Date(order.createdAt || order.date);
        let key;
        
        if (groupBy === 'hour') {
            key = date.toISOString().slice(0, 13);
        } else if (groupBy === 'day') {
            key = date.toISOString().slice(0, 10);
        } else if (groupBy === 'week') {
            const weekNumber = getWeekNumber(date);
            key = `${date.getFullYear()}-W${weekNumber}`;
        } else if (groupBy === 'month') {
            key = date.toISOString().slice(0, 7);
        }
        
        if (!groups[key]) {
            groups[key] = {
                orders: 0,
                revenue: 0,
                items: 0,
                customers: new Set()
            };
        }
        
        groups[key].orders++;
        groups[key].revenue += order.total || 0;
        groups[key].items += order.items?.length || 0;
        if (order.userId) {
            groups[key].customers.add(order.userId);
        }
    });
    
    // Convert to array and calculate averages
    return Object.entries(groups).map(([date, data]) => ({
        date,
        orders: data.orders,
        revenue: data.revenue,
        avgOrderValue: data.orders > 0 ? data.revenue / data.orders : 0,
        itemsPerOrder: data.orders > 0 ? data.items / data.orders : 0,
        uniqueCustomers: data.customers.size
    })).sort((a, b) => a.date.localeCompare(b.date));
}

function getWeekNumber(date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

function getOrderStatusDistribution(orders) {
    const distribution = {};
    orders.forEach(order => {
        const status = order.status || 'pending';
        distribution[status] = (distribution[status] || 0) + 1;
    });
    
    return Object.entries(distribution).map(([status, count]) => ({
        status,
        count,
        percentage: (count / orders.length * 100).toFixed(1)
    }));
}

function getTopProductsFromOrders(orders, products, limit) {
    const productSales = {};
    
    orders.forEach(order => {
        order.items?.forEach(item => {
            const productId = item.productId;
            if (!productSales[productId]) {
                productSales[productId] = {
                    quantity: 0,
                    revenue: 0,
                    orders: 0
                };
            }
            
            productSales[productId].quantity += item.quantity || 1;
            productSales[productId].revenue += (item.price || 0) * (item.quantity || 1);
            productSales[productId].orders++;
        });
    });
    
    return Object.entries(productSales)
        .map(([productId, data]) => {
            const product = products.find(p => p._id === productId);
            return {
                productId,
                name: product?.name || 'Unknown Product',
                category: product?.category || 'Unknown',
                ...data
            };
        })
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limit);
}

function getSalesByHour(orders) {
    const hours = Array(24).fill(0).map((_, i) => ({
        hour: i,
        orders: 0,
        revenue: 0
    }));
    
    orders.forEach(order => {
        const date = new Date(order.createdAt || order.date);
        const hour = date.getHours();
        hours[hour].orders++;
        hours[hour].revenue += order.total || 0;
    });
    
    return hours;
}

function getPaymentMethodDistribution(orders) {
    const distribution = {};
    orders.forEach(order => {
        const method = order.payment?.method || 'unknown';
        distribution[method] = (distribution[method] || 0) + 1;
    });
    
    return Object.entries(distribution).map(([method, count]) => ({
        method,
        count,
        percentage: (count / orders.length * 100).toFixed(1)
    }));
}

function getShippingMethodDistribution(orders) {
    const distribution = {};
    orders.forEach(order => {
        const method = order.shipping?.method || 'standard';
        distribution[method] = (distribution[method] || 0) + 1;
    });
    
    return Object.entries(distribution).map(([method, count]) => ({
        method,
        count,
        percentage: (count / orders.length * 100).toFixed(1)
    }));
}

// ==================== CUSTOMER ANALYTICS ====================

// Get customer analytics
app.get('/api/admin/analytics/customers', verifyAdmin, async (req, res) => {
    try {
        const users = readData('users');
        const orders = readData('orders');
        
        const customerAnalytics = {
            totalCustomers: users.length,
            activeCustomers: users.filter(u => u.isActive).length,
            newCustomers: users.filter(u => {
                const createdAt = new Date(u.createdAt);
                const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                return createdAt >= thirtyDaysAgo;
            }).length,
            customerLifetimeValue: calculateCustomerLifetimeValue(users, orders),
            churnRate: calculateChurnRate(users, orders),
            segmentation: segmentCustomers(users, orders),
            demographics: getCustomerDemographicsAnalytics(users),
            acquisitionChannels: getAcquisitionChannels(),
            retentionAnalysis: analyzeRetention(users, orders)
        };
        
        res.json({
            success: true,
            data: customerAnalytics
        });
    } catch (error) {
        console.error('Error fetching customer analytics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch customer analytics'
        });
    }
});

// Calculate customer lifetime value
function calculateCustomerLifetimeValue(users, orders) {
    const customerValues = {};
    
    orders.forEach(order => {
        if (order.userId) {
            if (!customerValues[order.userId]) {
                customerValues[order.userId] = 0;
            }
            customerValues[order.userId] += order.total || 0;
        }
    });
    
    const values = Object.values(customerValues);
    if (values.length === 0) return 0;
    
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    return avg;
}

// Calculate churn rate
function calculateChurnRate(users, orders) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    
    const activeUsers = users.filter(user => {
        const lastOrder = orders
            .filter(o => o.userId === user._id)
            .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))[0];
        
        if (!lastOrder) return false;
        const lastOrderDate = new Date(lastOrder.createdAt || lastOrder.date);
        return lastOrderDate >= thirtyDaysAgo;
    });
    
    const totalActive = users.filter(user => {
        const createdAt = new Date(user.createdAt);
        return createdAt >= ninetyDaysAgo;
    }).length;
    
    if (totalActive === 0) return 0;
    
    return ((totalActive - activeUsers.length) / totalActive * 100).toFixed(1);
}

// Segment customers
function segmentCustomers(users, orders) {
    const segments = {
        highValue: { users: [], criteria: 'Top 20% by spending', color: '#3b82f6' },
        mediumValue: { users: [], criteria: 'Middle 60% by spending', color: '#10b981' },
        lowValue: { users: [], criteria: 'Bottom 20% by spending', color: '#f59e0b' },
        new: { users: [], criteria: 'Joined in last 30 days', color: '#8b5cf6' },
        atRisk: { users: [], criteria: 'No purchase in 60+ days', color: '#ef4444' },
        dormant: { users: [], criteria: 'No purchase in 120+ days', color: '#9ca3af' }
    };
    
    // Calculate customer spending
    const customerSpending = {};
    orders.forEach(order => {
        if (order.userId) {
            customerSpending[order.userId] = (customerSpending[order.userId] || 0) + (order.total || 0);
        }
    });
    
    // Sort customers by spending
    const sortedCustomers = Object.entries(customerSpending)
        .sort(([,a], [,b]) => b - a)
        .map(([userId]) => userId);
    
    // Segment by spending
    const highValueCount = Math.ceil(sortedCustomers.length * 0.2);
    const mediumValueCount = Math.ceil(sortedCustomers.length * 0.6);
    
    segments.highValue.users = sortedCustomers.slice(0, highValueCount);
    segments.mediumValue.users = sortedCustomers.slice(highValueCount, highValueCount + mediumValueCount);
    segments.lowValue.users = sortedCustomers.slice(highValueCount + mediumValueCount);
    
    // Segment by recency
    const now = new Date();
    users.forEach(user => {
        const createdAt = new Date(user.createdAt);
        const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
        
        if (createdAt >= thirtyDaysAgo) {
            segments.new.users.push(user._id);
        }
        
        const lastOrder = orders
            .filter(o => o.userId === user._id)
            .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))[0];
        
        if (lastOrder) {
            const lastOrderDate = new Date(lastOrder.createdAt || lastOrder.date);
            const sixtyDaysAgo = new Date(now - 60 * 24 * 60 * 60 * 1000);
            const oneTwentyDaysAgo = new Date(now - 120 * 24 * 60 * 60 * 1000);
            
            if (lastOrderDate < sixtyDaysAgo && lastOrderDate >= oneTwentyDaysAgo) {
                segments.atRisk.users.push(user._id);
            } else if (lastOrderDate < oneTwentyDaysAgo) {
                segments.dormant.users.push(user._id);
            }
        }
    });
    
    // Convert to frontend format
    return Object.entries(segments).map(([key, segment]) => ({
        name: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
        users: segment.users.length,
        color: segment.color,
        criteria: segment.criteria
    }));
}

// Get customer demographics for analytics
function getCustomerDemographicsAnalytics(users) {
    const demographics = {
        ageGroups: { '18-24': 0, '25-34': 0, '35-44': 0, '45-54': 0, '55+': 0 },
        gender: { male: 0, female: 0, other: 0, unspecified: 0 },
        location: {},
        joinDateDistribution: {}
    };
    
    // Mock data generation
    users.forEach(() => {
        // Age groups (mock)
        const ageGroups = ['18-24', '25-34', '35-44', '45-54', '55+'];
        demographics.ageGroups[ageGroups[Math.floor(Math.random() * ageGroups.length)]]++;
        
        // Gender (mock)
        const genders = ['male', 'female', 'other', 'unspecified'];
        demographics.gender[genders[Math.floor(Math.random() * genders.length)]]++;
        
        // Location (mock)
        const locations = ['United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France'];
        const location = locations[Math.floor(Math.random() * locations.length)];
        demographics.location[location] = (demographics.location[location] || 0) + 1;
    });
    
    // Join date distribution (by month)
    users.forEach(user => {
        const joinDate = new Date(user.createdAt);
        const monthYear = joinDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        demographics.joinDateDistribution[monthYear] = (demographics.joinDateDistribution[monthYear] || 0) + 1;
    });
    
    return demographics;
}

// Mock acquisition channels
function getAcquisitionChannels() {
    return [
        { channel: 'Organic Search', users: 45, cost: 0, revenue: 15000 },
        { channel: 'Direct', users: 25, cost: 0, revenue: 12000 },
        { channel: 'Social Media', users: 15, cost: 500, revenue: 8000 },
        { channel: 'Email Marketing', users: 10, cost: 200, revenue: 6000 },
        { channel: 'Paid Ads', users: 5, cost: 1000, revenue: 4000 }
    ];
}

// Analyze retention
function analyzeRetention(users, orders) {
    const cohorts = {};
    const now = new Date();
    
    // Group users by join month
    users.forEach(user => {
        const joinDate = new Date(user.createdAt);
        const cohortKey = `${joinDate.getFullYear()}-${String(joinDate.getMonth() + 1).padStart(2, '0')}`;
        
        if (!cohorts[cohortKey]) {
            cohorts[cohortKey] = {
                totalUsers: 0,
                month1: 0,
                month2: 0,
                month3: 0,
                month6: 0,
                month12: 0
            };
        }
        
        cohorts[cohortKey].totalUsers++;
        
        // Check if user made purchases in subsequent months
        const userOrders = orders.filter(o => o.userId === user._id);
        if (userOrders.length > 0) {
            const firstOrderDate = new Date(userOrders[0].createdAt || userOrders[0].date);
            const monthsSinceJoin = Math.floor((firstOrderDate - joinDate) / (30 * 24 * 60 * 60 * 1000));
            
            if (monthsSinceJoin <= 1) cohorts[cohortKey].month1++;
            if (monthsSinceJoin <= 2) cohorts[cohortKey].month2++;
            if (monthsSinceJoin <= 3) cohorts[cohortKey].month3++;
            if (monthsSinceJoin <= 6) cohorts[cohortKey].month6++;
            if (monthsSinceJoin <= 12) cohorts[cohortKey].month12++;
        }
    });
    
    // Convert to percentage
    return Object.entries(cohorts).map(([cohort, data]) => ({
        cohort,
        totalUsers: data.totalUsers,
        month1: ((data.month1 / data.totalUsers) * 100).toFixed(1),
        month2: ((data.month2 / data.totalUsers) * 100).toFixed(1),
        month3: ((data.month3 / data.totalUsers) * 100).toFixed(1),
        month6: ((data.month6 / data.totalUsers) * 100).toFixed(1),
        month12: ((data.month12 / data.totalUsers) * 100).toFixed(1)
    }));
}

// ==================== REAL-TIME STATS ====================

// Get real-time dashboard stats
app.get('/api/admin/analytics/realtime', verifyAdmin, async (req, res) => {
    try {
        const orders = readData('orders');
        const users = readData('users');
        const products = readData('products');
        
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
        
        const todayOrders = orders.filter(order => {
            const orderDate = new Date(order.createdAt || order.date);
            return orderDate >= todayStart;
        });
        
        const yesterdayOrders = orders.filter(order => {
            const orderDate = new Date(order.createdAt || order.date);
            return orderDate >= yesterdayStart && orderDate < todayStart;
        });
        
        const todayRevenue = todayOrders.reduce((sum, order) => sum + (order.total || 0), 0);
        const yesterdayRevenue = yesterdayOrders.reduce((sum, order) => sum + (order.total || 0), 0);
        
        const revenueGrowth = yesterdayRevenue > 0 ? 
            ((todayRevenue - yesterdayRevenue) / yesterdayRevenue * 100).toFixed(1) : 0;
        
        const activeUsers = users.filter(user => {
            if (!user.lastLogin) return false;
            const lastLogin = new Date(user.lastLogin);
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
            return lastLogin >= oneHourAgo;
        }).length;
        
        const lowStockProducts = products.filter(p => p.stock > 0 && p.stock < 10).length;
        
        res.json({
            success: true,
            data: {
                liveOrders: todayOrders.length,
                todayRevenue,
                revenueGrowth: Number(revenueGrowth),
                activeUsers,
                lowStockProducts,
                conversionRate: calculateConversionRate(todayOrders),
                avgSessionDuration: '4m 32s',
                topSellingProduct: getTopSellingProduct(todayOrders, products),
                recentActivity: getRecentActivity(todayOrders, users, 5)
            },
            meta: {
                updatedAt: new Date().toISOString(),
                period: 'today'
            }
        });
    } catch (error) {
        console.error('Error fetching real-time stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch real-time stats'
        });
    }
});

// Calculate conversion rate (mock)
function calculateConversionRate(orders) {
    const baseRate = 3.0;
    const variation = Math.random() * 1 - 0.5;
    return (baseRate + variation).toFixed(1);
}

// Get top selling product today
function getTopSellingProduct(todayOrders, products) {
    if (todayOrders.length === 0) return null;
    
    const productSales = {};
    todayOrders.forEach(order => {
        order.items?.forEach(item => {
            const productId = item.productId;
            productSales[productId] = (productSales[productId] || 0) + (item.quantity || 1);
        });
    });
    
    const topProductId = Object.entries(productSales)
        .sort(([,a], [,b]) => b - a)[0]?.[0];
    
    if (!topProductId) return null;
    
    const product = products.find(p => p._id === topProductId);
    return product ? {
        name: product.name,
        sales: productSales[topProductId],
        revenue: productSales[topProductId] * (product.discountPrice || product.price)
    } : null;
}

// ==================== ANALYTICS EXPORT ====================

// Get analytics export data
app.get('/api/admin/analytics/export', verifyAdmin, async (req, res) => {
    try {
        const { format = 'json', type = 'dashboard' } = req.query;
        
        // Get the data based on type
        let data;
        if (type === 'dashboard') {
            data = await getDashboardExportData();
        } else if (type === 'products') {
            data = await getProductsExportData();
        } else if (type === 'orders') {
            data = await getOrdersExportData();
        } else if (type === 'customers') {
            data = await getCustomersExportData();
        }
        
        if (format === 'csv') {
            const csv = convertToCSV(data);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=${type}-export-${Date.now()}.csv`);
            return res.send(csv);
        } else if (format === 'excel') {
            const excelBuffer = convertToExcel(data);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=${type}-export-${Date.now()}.xlsx`);
            return res.send(excelBuffer);
        } else {
            // JSON format
            res.setHeader('Content-Disposition', `attachment; filename=${type}-export-${Date.now()}.json`);
            res.json({
                success: true,
                data,
                meta: {
                    exportedAt: new Date().toISOString(),
                    type,
                    format: 'json'
                }
            });
        }
    } catch (error) {
        console.error('Error exporting analytics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to export data'
        });
    }
});

// Helper function for CSV conversion
function convertToCSV(data) {
    if (!Array.isArray(data)) {
        data = [data];
    }
    
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [];
    
    // Add headers
    csvRows.push(headers.join(','));
    
    // Add rows
    for (const row of data) {
        const values = headers.map(header => {
            const value = row[header];
            const escaped = ('' + value).replace(/"/g, '""');
            return /[,"\n]/.test(escaped) ? `"${escaped}"` : escaped;
        });
        csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
}

// Mock Excel conversion
function convertToExcel(data) {
    const csv = convertToCSV(data);
    return Buffer.from(csv);
}

// Mock export data functions
async function getDashboardExportData() {
    const orders = readData('orders');
    const products = readData('products');
    const users = readData('users');
    
    return {
        summary: {
            totalRevenue: calculateTotalRevenue(orders, new Date(0), new Date()),
            totalOrders: orders.length,
            totalProducts: products.length,
            totalUsers: users.length,
            avgOrderValue: calculateAverageOrderValue(orders, new Date(0), new Date())
        },
        generatedAt: new Date().toISOString()
    };
}

async function getProductsExportData() {
    const products = readData('products');
    return products.map(p => ({
        id: p._id,
        name: p.name,
        category: p.category,
        brand: p.brand,
        price: p.price,
        discountPrice: p.discountPrice,
        stock: p.stock,
        status: p.isActive ? 'Active' : 'Inactive',
        sales: p.salesCount || 0,
        rating: p.rating?.average || 0,
        createdAt: p.createdAt
    }));
}

async function getOrdersExportData() {
    const orders = readData('orders');
    const users = readData('users');
    
    return orders.map(order => {
        const user = users.find(u => u._id === order.userId);
        return {
            id: order._id,
            customer: user ? `${user.firstName} ${user.lastName}` : 'Anonymous',
            email: user?.email,
            date: order.createdAt,
            items: order.items?.length || 0,
            total: order.total,
            status: order.status,
            shippingMethod: order.shipping?.method,
            paymentMethod: order.payment?.method
        };
    });
}

async function getCustomersExportData() {
    const users = readData('users');
    const orders = readData('orders');
    
    return users.map(user => {
        const userOrders = orders.filter(o => o.userId === user._id);
        return {
            id: user._id,
            name: `${user.firstName} ${user.lastName}`,
            email: user.email,
            phone: user.phone,
            joined: user.createdAt,
            lastLogin: user.lastLogin,
            totalOrders: userOrders.length,
            totalSpent: userOrders.reduce((sum, o) => sum + (o.total || 0), 0),
            avgOrderValue: userOrders.length > 0 ? 
                userOrders.reduce((sum, o) => sum + (o.total || 0), 0) / userOrders.length : 0,
            status: user.isActive ? 'Active' : 'Inactive'
        };
    });
}

// ==================== HEALTH CHECK ====================
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        service: 'Electronics Marketplace API',
        timestamp: new Date(),
        storage: 'JSON File Storage',
        dataFiles: Object.keys(DATA_FILES),
        endpoints: {
            auth: '/api/auth/*',
            products: '/api/products/*',
            admin: '/api/admin/*',
            categories: '/api/categories',
            analytics: '/api/admin/analytics/*'
        }
    });
});

// API documentation
app.get('/api', (req, res) => {
    res.json({
        message: 'Electronics Marketplace API v2.0',
        storage: 'File-based JSON storage',
        endpoints: {
            auth: {
                register: 'POST /api/auth/register',
                login: 'POST /api/auth/login',
                profile: 'GET /api/auth/me'
            },
            products: {
                list: 'GET /api/products',
                single: 'GET /api/products/:id',
                featured: 'GET /api/products/featured/random',
                byCategory: 'GET /api/products/category/:category'
            },
            categories: {
                list: 'GET /api/categories'
            },
            admin: {
                dashboard: 'GET /api/admin/dashboard/stats',
                users: 'GET /api/admin/users',
                products: 'GET /api/admin/products',
                createProduct: 'POST /api/admin/products',
                updateProduct: 'PUT /api/admin/products/:id',
                bulkDelete: 'DELETE /api/admin/products/bulk',
                bulkUpload: 'POST /api/admin/products/bulk',
                productDetails: 'GET /api/admin/products/:id/details',
                template: 'GET /api/admin/products/template'
            },
            analytics: {
                dashboard: 'GET /api/admin/analytics/dashboard',
                orders: 'GET /api/admin/analytics/orders',
                customers: 'GET /api/admin/analytics/customers',
                realtime: 'GET /api/admin/analytics/realtime',
                export: 'GET /api/admin/analytics/export'
            }
        }
    });
});

// Serve frontend for any route
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
        res.status(404).json({ 
            success: false,
            error: 'API endpoint not found' 
        });
    } else {
        // Serve frontend files
        res.sendFile(path.join(__dirname, '../index.html'));
    }
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err.stack);
    
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            error: 'Invalid token'
        });
    }
    
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            error: 'Token expired'
        });
    }
    
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal server error'
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(60));
    console.log(`🚀 Server running on port ${PORT}`);
    console.log('='.repeat(60));
    console.log(`🌐 Health check: http://localhost:${PORT}/health`);
    console.log(`📚 API Docs: http://localhost:${PORT}/api`);
    console.log(`💻 Frontend: http://localhost:${PORT}/`);
    console.log(`📊 Admin Dashboard: http://localhost:${PORT}/admin.html`);
    console.log(`🔐 Admin Login: http://localhost:${PORT}/admin-login.html`);
    console.log('='.repeat(60));
    console.log(`👑 Admin Credentials:`);
    console.log(`   Email: admin@electroshop.com`);
    console.log(`   Password: Admin@123`);
    console.log('='.repeat(60));
    console.log(`👤 Test User Credentials:`);
    console.log(`   Email: test@example.com`);
    console.log(`   Password: Test@123`);
    console.log('='.repeat(60));
    console.log(`📊 Analytics Features:`);
    console.log(`   • Dashboard Analytics`);
    console.log(`   • Order Analytics`);
    console.log(`   • Customer Analytics`);
    console.log(`   • Real-time Stats`);
    console.log(`   • Bulk Product Management`);
    console.log(`   • Data Export (JSON/CSV)`);
    console.log('='.repeat(60));
});
