import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { ListInvoicesDto } from './dto/list-invoices.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Tenants')
@Controller('tenants/:tenantId/invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  async create(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.invoicesService.create(tenantId, dto);
  }

  @Get()
  async list(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Query() filters: ListInvoicesDto,
  ) {
    return this.invoicesService.findAll(tenantId, filters);
  }

  @Delete(':id')
  async delete(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.invoicesService.delete(tenantId, id);
  }
}
