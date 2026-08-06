import { Request, Response, NextFunction, Router } from 'express';
import { InvoiceController } from '../controllers/InvoiceController';
import { Routes } from "../../../core/routes/interfaces";
import { authenticate, authorize } from '../../../core/middlewares/AuthMiddleware';
import { UserRole } from '@prisma/client';
import { invoiceSchema, recordPaymentSchema } from '../schema/invoice.schema';
import { validate } from '../../../core/middlewares';

class InvoiceRoute implements Routes {
  public path = '/invoices';
  public router = Router();
  public invoiceController = new InvoiceController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Create a new invoice (FinSec)
    this.router.post(`${this.path}`,
      authenticate,
      validate(invoiceSchema),
      this.invoiceController.createInvoice
    );

    // Get all invoices (paginated)
    this.router.get(`${this.path}`,
      authenticate,
      this.invoiceController.getInvoices
    );

    // Get single invoice by ID (with payment summary)
    this.router.get(`${this.path}/:id`,
      authenticate,
      this.invoiceController.getInvoiceById
    );

    // Approve an invoice (Admin)
    this.router.patch(`${this.path}/:id/approve`,
      authenticate,
      authorize(UserRole.ADMIN),
      this.invoiceController.approveInvoice
    );

    // Record a payment / installment (Admin)
    this.router.post(`${this.path}/:id/payments`,
      authenticate,
      authorize(UserRole.ADMIN),
      validate(recordPaymentSchema),
      this.invoiceController.recordPayment
    );

    // Get all payments for an invoice
    this.router.get(`${this.path}/:id/payments`,
      authenticate,
      this.invoiceController.getPayments
    );

    // Mark invoice as fully paid (records remaining balance as payment)
    this.router.patch(`${this.path}/:id/mark-paid`,
      authenticate,
      authorize(UserRole.ADMIN),
      this.invoiceController.markAsPaid
    );

    // Update an invoice (only if CREATED status)
    this.router.put(`${this.path}/:id`,
      authenticate,
      this.invoiceController.updateInvoice
    );

    // Delete an invoice (only if CREATED status)
    this.router.delete(`${this.path}/:id`,
      authenticate,
      this.invoiceController.deleteInvoice
    );
  }
}

export { InvoiceRoute };
