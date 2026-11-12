import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '../generated/prisma/enums';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import {
  assignTicketSchema,
  changeTicketStatusSchema,
  createTicketCommentSchema,
  createTicketSchema,
  listTicketsSchema,
  suggestTicketSchema,
  updateTicketSchema,
} from './ticket.dto';
import { TicketsService } from './tickets.service';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  create(
    @Body() rawBody: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ticketsService.create(
      user,
      this.parse(createTicketSchema, rawBody),
    );
  }

  @Post('suggest')
  suggest(
    @Body() rawBody: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ticketsService.suggest(
      user,
      this.parse(suggestTicketSchema, rawBody),
    );
  }

  @Get()
  list(
    @Query() rawQuery: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ticketsService.list(
      user,
      this.parse(listTicketsSchema, rawQuery),
    );
  }

  @Get(':id')
  getDetail(
    @Param('id') ticketId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ticketsService.getDetail(ticketId, user);
  }

  @Patch(':id')
  update(
    @Param('id') ticketId: string,
    @Body() rawBody: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ticketsService.update(
      ticketId,
      this.parse(updateTicketSchema, rawBody),
      user,
    );
  }

  @Post(':id/status')
  changeStatus(
    @Param('id') ticketId: string,
    @Body() rawBody: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ticketsService.changeStatus(
      ticketId,
      this.parse(changeTicketStatusSchema, rawBody),
      user,
    );
  }

  @Post(':id/assign')
  assign(
    @Param('id') ticketId: string,
    @Body() rawBody: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ticketsService.assign(
      ticketId,
      this.parse(assignTicketSchema, rawBody),
      user,
    );
  }

  @Post(':id/comments')
  addComment(
    @Param('id') ticketId: string,
    @Body() rawBody: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ticketsService.addComment(
      ticketId,
      this.parse(createTicketCommentSchema, rawBody),
      user,
    );
  }

  @Delete(':id')
  @Roles(Role.IT_ADMIN)
  remove(
    @Param('id') ticketId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ticketsService.remove(ticketId, user);
  }

  private parse<T>(schema: { safeParse: (input: unknown) => any }, input: unknown): T {
    const result = schema.safeParse(input);
    if (!result.success) {
      throw new BadRequestException(
        result.error.issues.map((issue: { message: string }) => issue.message).join('; '),
      );
    }
    return result.data as T;
  }
}
