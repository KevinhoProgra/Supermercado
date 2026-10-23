import { Router } from 'express';
import * as controller from '../controllers/businessController.js';
import { authenticate, requirePermission, requireRoles } from '../middleware/authMiddleware.js';
import { ROLES } from '../constants/roles.js';

const router = Router();
router.use(authenticate);

router.get('/products', requirePermission('productos:read'), controller.listProducts);
router.get('/sales/products', requirePermission('ventas:catalog'), controller.listSalesProducts);
router.post('/products', requireRoles(ROLES.ADMIN), controller.saveProduct);
router.put('/products/:id', requireRoles(ROLES.ADMIN), controller.saveProduct);
router.get('/config', requirePermission('ventas:catalog'), controller.getConfig);
router.put('/config', requireRoles(ROLES.ADMIN), controller.updateConfig);
router.post('/sales', requirePermission('ventas:create'), controller.createSale);
router.get('/suppliers', requirePermission('proveedores:read'), controller.listSuppliers);
router.post('/suppliers', requirePermission('proveedores:create'), controller.createSupplier);
router.get('/purchase-suggestions', requirePermission('compras:read'), controller.listPurchaseSuggestions);
router.get('/purchase-orders', requirePermission('compras:read'), controller.listPurchaseOrders);
router.post('/purchase-orders', requirePermission('compras:create'), controller.createPurchaseOrder);
router.post('/purchase-orders/:id/approve', requireRoles(ROLES.ADMIN), controller.approvePurchaseOrder);
router.post('/purchases', requirePermission('compras:create'), controller.registerPurchase);
router.get('/reports/sales', requirePermission('reportes:ventas'), controller.salesReport);
router.get('/reports/cashflow', requirePermission('reportes:caja'), controller.cashflowReport);
router.get('/admin/users', requireRoles(ROLES.ADMIN), controller.adminUsers);
router.post('/admin/users', requireRoles(ROLES.ADMIN), controller.createAdminUser);
router.patch('/admin/users/:id', requireRoles(ROLES.ADMIN), controller.updateAdminUser);
router.delete('/admin/users/:id', requireRoles(ROLES.ADMIN), controller.deactivateAdminUser);
router.post('/admin/users/:id/unlock', requireRoles(ROLES.ADMIN), controller.unlockAdminUser);
router.get('/admin/login-locks', requireRoles(ROLES.ADMIN), controller.loginFormLocks);
router.post('/admin/login-locks/unlock', requireRoles(ROLES.ADMIN), controller.unlockAdminLoginForm);
router.get('/admin/roles', requireRoles(ROLES.ADMIN), controller.adminRoles);
router.post('/admin/roles', requireRoles(ROLES.ADMIN), controller.createAdminRole);
router.put('/admin/roles/:id', requireRoles(ROLES.ADMIN), controller.updateAdminRole);
router.get('/admin/audit', requireRoles(ROLES.ADMIN), controller.auditLog);

export default router;
